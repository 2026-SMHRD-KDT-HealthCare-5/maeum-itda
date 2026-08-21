/*
역할: 단기 전용 토큰으로 인증한 TTS 오디오 스트리밍 요청을 AI서버 응답 그대로 중계한다.
연결 객체: AuthService(토큰 검증), ConversationMessageRepository(질문 텍스트 조회), TtsClient
전체 흐름: 프론트 <audio src> GET 요청 → 토큰 검증 → AI 질문 메시지 조회 → AI서버 스트리밍 호출 → 응답 그대로 중계
주의: <audio src>는 Authorization 헤더를 못 붙이므로 AccessTokenGuard를 쓰지 않고
쿼리 파라미터의 단기 전용 토큰(AuthService.verifyTtsStreamToken, packages/shared-types의
TtsTransferPayload.streamPath에 실려온다)으로 인증한다.
*/
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { AuthService } from '../auth/auth.service';
import { TtsClient } from '../analysis/tts.client';
import { ConversationMessageRepository } from './repositories/conversation-message.repository';

@ApiTags('3. 대화 기록')
@Controller('chats')
export class TtsStreamController {
  private readonly authService: AuthService;
  private readonly ttsClient: TtsClient;
  private readonly conversationMessageRepository: ConversationMessageRepository;

  constructor(
    authService: AuthService,
    ttsClient: TtsClient,
    conversationMessageRepository: ConversationMessageRepository,
  ) {
    this.authService = authService;
    this.ttsClient = ttsClient;
    this.conversationMessageRepository = conversationMessageRepository;
  }

  // 역할: tts:audio의 streamPath가 가리키는 TTS 오디오를 스트리밍으로 응답한다.
  // JSON이 아닌 raw 오디오 바이트를 그대로 흘려보내는 특수 엔드포인트라 Swagger
  // 문서에서는 제외한다 — 계약은 packages/shared-types와 docs/ws-protocol.md 기준.
  @Get('tts-stream')
  @ApiExcludeEndpoint()
  async streamTts(
    @Query('messageId') messageIdRaw: string,
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const messageId = Number(messageIdRaw);
    if (!Number.isInteger(messageId) || !token) {
      throw new HttpException(
        '요청 형식이 올바르지 않습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const payload = await this.authService.verifyTtsStreamToken(token);
    if (payload.messageId !== messageId) {
      throw new HttpException(
        '유효하지 않은 인증정보입니다.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const content =
      await this.conversationMessageRepository.findAiQuestionContent(
        messageId,
        payload.seniorId,
      );
    if (content === null) {
      throw new HttpException(
        '요청한 질문을 찾을 수 없습니다.',
        HttpStatus.NOT_FOUND,
      );
    }

    const upstream = await this.ttsClient.synthesizeStream(content);
    const contentType = upstream.headers.get('content-type');
    if (contentType !== null) res.setHeader('Content-Type', contentType);
    res.status(HttpStatus.OK);
    Readable.fromWeb(upstream.body as unknown as NodeWebReadableStream).pipe(
      res,
    );
  }
}
