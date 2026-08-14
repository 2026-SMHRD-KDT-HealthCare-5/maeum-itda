/*
역할: 리포트 생성 등 도메인 이벤트를 보호자 알림 레코드로 변환한다.
전체 흐름: Reports 스케줄 작업 → NotificationsService → GuardianNotificationRepository → MySQL
주의: 실제 웹 푸시는 PushSubscription/VAPID 인프라가 추가된 뒤 이 서비스 뒤에 연결한다.
*/
import { Injectable } from '@nestjs/common';
import { GuardianNotification } from './entities/guardian-notification.entity';
import { GuardianNotificationRepository } from './repositories/guardian-notification.repository';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationRepository: GuardianNotificationRepository,
  ) {}

  createWeeklyReportReadyNotification(
    guardianId: number,
    weeklyReportId: number,
  ): Promise<GuardianNotification> {
    return this.notificationRepository.saveWeeklyReportReady(
      guardianId,
      weeklyReportId,
      '지난주 주간 리포트가 도착했어요.',
    );
  }
}
