/*
역할: NestJS 서버를 시작하고 WebSocket 통신 환경을 등록한다.
전체 흐름: 환경변수 → 서버·CORS 설정 → NestJS REST API/WsAdapter → ChatsGateway
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { resolveCorsOrigins, resolveServerPort } from './config/server.config';
import { setupSwagger } from './config/swagger.config';

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
