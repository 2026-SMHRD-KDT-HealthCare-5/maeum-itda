/*
역할: <audio src> GET 요청이 단기 토큰으로 인증되고, AI서버 스트리밍 응답이 그대로
중계되는지 확인한다.
*/
import { HttpException } from '@nestjs/common';
import { Writable } from 'node:stream';
import type { AuthService } from '../auth/auth.service';
import type { TtsClient } from '../analysis/tts.client';
import type { ConversationMessageRepository } from './repositories/conversation-message.repository';
import { TtsStreamController } from './tts-stream.controller';

// Response.body를 Readable.fromWeb()으로 소비하는 실제 파이핑 동작까지 검증하기
// 위해 Response는 목이 아니라 실제 Fetch API 구현을 그대로 쓴다.
function createResponse() {
  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  let statusCode: number | undefined;
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk as Buffer));
      callback();
    },
  }) as Writable & {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => void;
  };
  writable.setHeader = (name, value) => {
    headers[name] = value;
  };
  writable.status = (code) => {
    statusCode = code;
  };

  return {
    writable,
    headers,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return Buffer.concat(chunks).toString('utf-8');
    },
    finished: new Promise<void>((resolve) => writable.on('finish', resolve)),
  };
}

describe('TtsStreamController', () => {
  function createController(
    overrides: {
      verifyTtsStreamToken?: jest.Mock;
      findAiQuestionContent?: jest.Mock;
      synthesizeStream?: jest.Mock;
    } = {},
  ) {
    const authService = {
      verifyTtsStreamToken:
        overrides.verifyTtsStreamToken ??
        jest.fn().mockResolvedValue({ messageId: 101, seniorId: 7 }),
    };
    const conversationMessageRepository = {
      findAiQuestionContent:
        overrides.findAiQuestionContent ??
        jest.fn().mockResolvedValue('산책은 어떠셨어요?'),
    };
    const ttsClient = {
      synthesizeStream:
        overrides.synthesizeStream ??
        jest.fn().mockResolvedValue(
          new Response(new Blob([new Uint8Array([1, 2, 3])]), {
            status: 200,
            headers: { 'Content-Type': 'audio/mpeg' },
          }),
        ),
    };
    const controller = new TtsStreamController(
      authService as unknown as AuthService,
      ttsClient as unknown as TtsClient,
      conversationMessageRepository as unknown as ConversationMessageRepository,
    );
    return {
      controller,
      authService,
      conversationMessageRepository,
      ttsClient,
    };
  }

  it('토큰을 검증하고 질문 텍스트로 AI서버 스트림을 호출해 그대로 중계한다', async () => {
    const {
      controller,
      authService,
      conversationMessageRepository,
      ttsClient,
    } = createController();
    const response = createResponse();

    await controller.streamTts(
      '101',
      'valid-token',
      response.writable as unknown as import('express').Response,
    );
    await response.finished;

    expect(authService.verifyTtsStreamToken).toHaveBeenCalledWith(
      'valid-token',
    );
    expect(
      conversationMessageRepository.findAiQuestionContent,
    ).toHaveBeenCalledWith(101, 7);
    expect(ttsClient.synthesizeStream).toHaveBeenCalledWith(
      '산책은 어떠셨어요?',
    );
    expect(response.headers['Content-Type']).toBe('audio/mpeg');
    expect(response.statusCode).toBe(200);
    expect(Buffer.from(response.body, 'utf-8')).toEqual(Buffer.from([1, 2, 3]));
  });

  it('요청 형식이 올바르지 않으면(messageId 숫자 아님) 400을 던진다', async () => {
    const { controller } = createController();
    const response = createResponse();

    await expect(
      controller.streamTts(
        'not-a-number',
        'token',
        response.writable as unknown as import('express').Response,
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('토큰의 messageId와 쿼리의 messageId가 다르면 401을 던진다', async () => {
    const { controller } = createController({
      verifyTtsStreamToken: jest
        .fn()
        .mockResolvedValue({ messageId: 999, seniorId: 7 }),
    });
    const response = createResponse();

    await expect(
      controller.streamTts(
        '101',
        'mismatched-token',
        response.writable as unknown as import('express').Response,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('해당 시니어의 AI 질문을 찾지 못하면 404를 던진다', async () => {
    const { controller } = createController({
      findAiQuestionContent: jest.fn().mockResolvedValue(null),
    });
    const response = createResponse();

    await expect(
      controller.streamTts(
        '101',
        'valid-token',
        response.writable as unknown as import('express').Response,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
