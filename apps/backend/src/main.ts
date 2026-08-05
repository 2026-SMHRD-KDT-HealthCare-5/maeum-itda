//NestFactoryNest 애플리케이션 인스턴스를 생성하는 핵심 함수를 사용하는 애플리케이션의 진입 파일
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.listen(3000);
}

void bootstrap();
