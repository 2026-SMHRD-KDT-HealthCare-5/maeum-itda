/*
역할: NestJS 서버를 시작하고 WebSocket 통신 환경을 등록한다.
전체 흐름: 브라우저 → WsAdapter → ChatsGateway
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
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

  // 로컬 Vite 프론트엔드에서 NestJS REST API를 호출할 수 있게 허용한다.
  // 배포 도메인은 확정 후 환경변수 기반 허용 목록으로 확장한다.
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // HTTP Upgrade 요청을 표준 WebSocket 방식으로 처리할 WsAdapter를 등록한다.
  app.useWebSocketAdapter(new WsAdapter(app));
  setupSwagger(app);
  await app.listen(3000);
}

void bootstrap();
