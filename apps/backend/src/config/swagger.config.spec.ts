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
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuthService } from '../auth/auth.service';
import { ChatsController } from '../chats/chats.controller';
import { ChatsService } from '../chats/chats.service';
import { ConnectionsController } from '../connections/connections.controller';
import { ConnectionsService } from '../connections/connections.service';
import { ProfileSettingsController } from '../profile-settings/profile-settings.controller';
import { ProfileSettingsService } from '../profile-settings/profile-settings.service';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import { setupSwagger } from './swagger.config';

describe('Swagger configuration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AuthController,
        UsersController,
        ProfileSettingsController,
        ConnectionsController,
        ChatsController,
        AnalysisController,
      ],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: ProfileSettingsService, useValue: {} },
        { provide: ConnectionsService, useValue: {} },
        { provide: AccessTokenGuard, useValue: { canActivate: () => true } },
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
    expect(response.text).toContain('"/auth/login"');
    expect(response.text).toContain('"/users/me"');
    expect(response.text).toContain('"/users/me/emotion-alert-settings"');
    expect(response.text).toContain('"/users/me/checkin-reminder-settings"');
    expect(response.text).toContain('"/connections/me"');
    expect(response.text).toContain('"/connections/requests"');
    expect(response.text).toContain(
      '"/connections/requests/{relationshipId}/accept"',
    );
    expect(response.text).toContain(
      '"/connections/requests/{relationshipId}/reject"',
    );
    expect(response.text).toContain('"/chats/messages"');
    expect(response.text).toContain('"/analysis/audio/{messageId}/status"');
    expect(response.text).toContain(
      '"/analysis/audio/question/{questionMessageId}/retry"',
    );
    expect(response.text).toContain('"SignUpResponseDto"');
    expect(response.text).toContain('"LoginResponseDto"');
    expect(response.text).toContain('"UserResponseDto"');
    expect(response.text).toContain('"GuardianAlertSettingResponseDto"');
    expect(response.text).toContain('"SeniorCheckinSettingResponseDto"');
    expect(response.text).toContain('"ConnectionResponseDto"');
    expect(response.text).toContain('"ChatHistoryPageResponseDto"');
    expect(response.text).toContain('"VoiceAnalysisStatusResponseDto"');
  });
});
