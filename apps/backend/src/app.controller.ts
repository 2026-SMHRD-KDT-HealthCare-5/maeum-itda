/*
역할: 애플리케이션 기본 REST API 요청을 받는 Controller다.
전체 흐름: 브라우저 → AppController → AppService
*/
import { Controller } from '@nestjs/common';
import { AppService } from './app.service';

// 기본 HTTP 경로를 이 Controller로 연결한다.
@Controller()
export class AppController {
  private readonly appService: AppService;

  // NestJS DI 컨테이너가 AppService 객체를 생성자에 주입한다.
  constructor(appService: AppService) {
    this.appService = appService;
  }
}
