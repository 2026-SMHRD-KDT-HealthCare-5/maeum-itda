
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

  // HTTP Upgrade 요청을 표준 WebSocket 방식으로 처리할 WsAdapter를 등록한다.
  app.useWebSocketAdapter(new WsAdapter(app));
  setupSwagger(app);
  await app.listen(3000);
}

void bootstrap();
