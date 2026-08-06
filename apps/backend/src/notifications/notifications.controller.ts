/*
역할: 보호자 알림 조회·확인 REST API 요청을 받는 입구다.
전체 흐름: 브라우저 → NotificationsController → NotificationsService → Repository → MySQL
*/
import { Controller } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// /notifications 경로의 HTTP 요청을 이 Controller로 전달한다.
@Controller('notifications')
export class NotificationsController {
  private readonly notificationsService: NotificationsService;

  // NestJS DI 컨테이너가 NotificationsService 객체를 생성자에 주입한다.
  constructor(notificationsService: NotificationsService) {
    this.notificationsService = notificationsService;
  }

  // 알림 조회·확인 REST API 메서드는 이후 이 클래스에 추가한다.
}
