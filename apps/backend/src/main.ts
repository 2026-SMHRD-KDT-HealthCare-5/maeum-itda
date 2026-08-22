/*
역할: NestJS 서버를 시작하고 WebSocket 통신 환경을 등록한다.
전체 흐름: 환경변수 → 서버·CORS 설정 → NestJS REST API/WsAdapter → ChatsGateway
 */
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { resolveCorsOrigins, resolveServerPort } from './config/server.config';
import { setupSwagger } from './config/swagger.config';

// 안전망: 어딘가에서 처리되지 않은 예외/rejection이 나면 Node는 기본적으로 프로세스
// 전체를 죽인다 — 한 WebSocket 메시지나 한 REST 요청 처리 중 생긴 버그가 그 순간의
// 모든 사용자 연결을 함께 끊는 사고로 이어진다(실제로 2026-08-22 TTS 스트림 크래시가
// 이 경로로 발생했다). 이걸 완전히 막는 근본 해결은 호출부마다 빠짐없이 catch하는
// 것이지만, 그 안전망에 구멍이 하나라도 남아있으면 여전히 위험하므로 최후 방어선으로
// 로그만 남기고 프로세스는 살려둔다.
const logger = new Logger('UnhandledError');
process.on('unhandledRejection', (reason) => {
  logger.error(
    '처리되지 않은 Promise rejection',
    reason instanceof Error ? reason.stack : String(reason),
  );
});
process.on('uncaughtException', (error) => {
  logger.error('처리되지 않은 예외', error.stack);
});

async function bootstrap() {
  // AppModule을 기준으로 NestJS 애플리케이션 객체를 생성한다.
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 로컬 Vite와 배포된 Vercel 프론트가 CORS_ORIGINS 허용 목록을 공유한다.
  app.enableCors({
    origin: resolveCorsOrigins(process.env.CORS_ORIGINS),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // HTTP Upgrade 요청을 표준 WebSocket 방식으로 처리할 WsAdapter를 등록한다.
  app.useWebSocketAdapter(new WsAdapter(app));
  setupSwagger(app);

  // Render에서는 주입된 PORT에, 로컬에서는 기본 3000 포트에 바인딩한다.
  await app.listen(resolveServerPort(process.env.PORT), '0.0.0.0');
}

void bootstrap();
