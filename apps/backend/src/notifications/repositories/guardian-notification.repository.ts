/* 역할: 보호자 알림을 대상 리포트별로 한 번만 저장한다. */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AlertType,
  GuardianNotification,
} from '../entities/guardian-notification.entity';

@Injectable()
export class GuardianNotificationRepository {
  constructor(
    @InjectRepository(GuardianNotification)
    private readonly repository: Repository<GuardianNotification>,
  ) {}

  async saveWeeklyReportReady(
    guardianId: number,
    weeklyReportId: number,
    content: string,
  ): Promise<GuardianNotification> {
    // 동일 WEEKLY_REPORT_ID 재집계 시 이미 읽은 알림 상태를 되돌리지 않고 중복 insert만 무시한다.
    await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        guardianId,
        dailyReportId: null,
        weeklyReportId,
        alertType: AlertType.WEEKLY_REPORT_READY,
        content,
        isRead: false,
      })
      .orIgnore()
      .execute();
    return this.repository.findOneByOrFail({ weeklyReportId });
  }
}
