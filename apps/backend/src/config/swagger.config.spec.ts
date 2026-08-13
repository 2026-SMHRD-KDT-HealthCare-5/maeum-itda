/*
역할: DB나 FastAPI를 실행하지 않고 현재 REST Controller가 OpenAPI JSON에 노출되는지 검증한다.
연결 흐름: 테스트용 Nest 앱 → setupSwagger() → GET /api-docs-json → paths·schemas 확인
*/
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AnalysisController } from '../analysis/analysis.controller';
import { AnalysisService } from '../analysis/analysis.service';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { ChatsController } from '../chats/chats.controller';
import { ChatsService } from '../chats/chats.service';
import { setupSwagger } from './swagger.config';

describe('Swagger configuration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, ChatsController, AnalysisController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: ChatsService, useValue: {} },
        { provide: AnalysisService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('확정한 JSON 주소에서 현재 REST API와 응답 schema를 제공한다', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer)
      .get('/api-docs-json')
      .expect(200);

    expect(response.text).toContain('"/auth/check-login-id"');
    expect(response.text).toContain('"/auth/signup"');
    expect(response.text).toContain('"/chats/messages"');
    expect(response.text).toContain('"/analysis/audio/{messageId}/status"');
    expect(response.text).toContain(
      '"/analysis/audio/question/{questionMessageId}/retry"',
    );
    expect(response.text).toContain('"SignUpResponseDto"');
    expect(response.text).toContain('"ChatHistoryPageResponseDto"');
    expect(response.text).toContain('"VoiceAnalysisStatusResponseDto"');
  });
});
