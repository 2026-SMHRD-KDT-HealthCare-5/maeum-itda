/*
역할: AppController와 AppService의 기본 연결을 단위 테스트한다.
전체 흐름: Jest → TestingModule → AppController 테스트 객체
*/
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    // 테스트용 NestJS 모듈에서 Controller와 Provider 객체를 생성한다.
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });
});
