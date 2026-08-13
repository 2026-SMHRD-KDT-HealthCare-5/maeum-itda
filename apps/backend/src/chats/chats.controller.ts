/*
역할: 과거 대화 조회처럼 WebSocket이 아닌 채팅 REST API 요청을 받는 입구다.
전체 흐름: 브라우저 → ChatsController → ChatsService → Repository → MySQL
*/
import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto';
import { UserRole } from '../users/entities/user.entity';
import { ChatsService } from './chats.service';
import { ChatHistoryPageResponseDto } from './dto/chat-history-response.dto';

// /chats 경로의 HTTP 요청을 이 Controller로 전달한다.
@ApiTags('3. 대화 기록')
@ApiBearerAuth()
@Controller('chats')
export class ChatsController {
  private readonly chatsService: ChatsService;

  // NestJS DI 컨테이너가 ChatsService 객체를 생성자에 주입한다.
  constructor(
    chatsService: ChatsService,
    private readonly authService: AuthService,
  ) {
    this.chatsService = chatsService;
  }

  // 역할: 인증된 시니어 본인의 과거 대화만 cursor 기반으로 조회한다.
  @Get('messages')
  @ApiOperation({ summary: '무한 스크롤' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: Number,
    description: '이 ID보다 오래된 메시지를 조회한다.',
    example: 101,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '조회 개수(기본 30, 최소 1, 최대 100)',
    example: 30,
  })
  @ApiOkResponse({
    description: '대화 메시지와 다음 cursor 반환',
    type: ChatHistoryPageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'cursor 또는 limit 형식·범위 오류',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer Token 누락·만료 또는 시니어 계정이 아님',
    type: ApiErrorResponseDto,
  })
  async getMessages(
    @Headers('authorization') authorization: string | undefined,
    @Query('cursor') cursorValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const accessToken = this.extractBearerToken(authorization);
    const user = await this.authService.verifyAccessToken(accessToken);
    if (user.role !== UserRole.SENIOR) {
      throw new UnauthorizedException(
        '시니어 계정만 대화를 조회할 수 있습니다.',
      );
    }
    const cursor = cursorValue === undefined ? undefined : Number(cursorValue);
    const limit = limitValue === undefined ? 30 : Number(limitValue);
    if (
      (cursor !== undefined && (!Number.isInteger(cursor) || cursor <= 0)) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'cursor 또는 limit 값이 올바르지 않습니다.',
      );
    }
    return this.chatsService.getMessageHistory(user.sub, cursor, limit);
  }

  private extractBearerToken(authorization: string | undefined): string {
    if (authorization?.startsWith('Bearer ') !== true) {
      throw new UnauthorizedException('Bearer 인증 토큰이 필요합니다.');
    }
    return authorization.slice('Bearer '.length);
  }
}
