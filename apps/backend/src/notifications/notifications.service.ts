/*
역할: 위험 알림 생성·조회·확인 업무를 처리할 Service다.
전체 흐름: NotificationsController → NotificationsService → Repository → MySQL
*/
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  // 알림 생성·조회 메서드와 Repository 호출은 이후 이 클래스에 추가한다.
}
