/*
역할: GUARDIAN_NOTIFICATION 저장·목록·읽음 처리를 한 곳에 캡슐화한다.
목록 조회에서는 리포트 날짜를 함께 조인해 프론트의 이동 대상을 구성할 수 있게 한다.
*/
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AlertType,
  GuardianNotification,
} from '../entities/guardian-notification.entity';

export interface NotificationListRow {
  alertId: number;
  alertType: AlertType;
  content: string;
  // getRawMany() 결과는 DB 드라이버 설정에 따라 boolean, 숫자 또는 문자열일 수 있다.
  isRead: boolean | number | string;
  createdAt: Date;
  dailyReportId: number | null;
  reportDate: string | null;
  weeklyReportId: number | null;
  weekStart: string | null;
}

export interface SavedNotification {
  notification: GuardianNotification;
  created: boolean;
}

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
  ): Promise<SavedNotification> {
    // 같은 주간 리포트의 스케줄러 재실행은 중복 알림을 만들지 않는다.
    const result = await this.repository
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
    return {
      notification: await this.repository.findOneByOrFail({ weeklyReportId }),
      created: this.wasInserted(result.raw),
    };
  }

  async saveEmotionIndexDrop(
    guardianId: number,
    dailyReportId: number,
    content: string,
  ): Promise<SavedNotification> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        guardianId,
        dailyReportId,
        weeklyReportId: null,
        alertType: AlertType.EMOTION_INDEX_DROP,
        content,
        isRead: false,
      })
      .orIgnore()
      .execute();
    return {
      notification: await this.repository.findOneByOrFail({ dailyReportId }),
      created: this.wasInserted(result.raw),
    };
  }

  async findPage(
    guardianId: number,
    cursor: number | undefined,
    limit: number,
  ): Promise<NotificationListRow[]> {
    // cursor보다 작은 ALERT_ID를 최신순으로 조회해 새 알림 추가 중에도 페이지 중복을 막는다.
    const query = this.repository
      .createQueryBuilder('notification')
      .leftJoin(
        'DAILY_EMOTION_REPORT',
        'dailyReport',
        'dailyReport.REPORT_ID = notification.DAILY_REPORT_ID',
      )
      .leftJoin(
        'WEEKLY_EMOTION_REPORT',
        'weeklyReport',
        'weeklyReport.WEEKLY_REPORT_ID = notification.WEEKLY_REPORT_ID',
      )
      .select('notification.ALERT_ID', 'alertId')
      .addSelect('notification.ALERT_TYPE', 'alertType')
      .addSelect('notification.CONTENT', 'content')
      .addSelect('notification.IS_READ', 'isRead')
      .addSelect('notification.CREATED_AT', 'createdAt')
      .addSelect('notification.DAILY_REPORT_ID', 'dailyReportId')
      // getRawMany()는 엔티티 컬럼 변환을 안 타서 DATE 컬럼이 드라이버 그대로(Date
      // 객체)로 나온다 — JSON 직렬화하면 "2026-08-17T00:00:00.000Z"처럼 풀 타임스탬프가
      // 되어 프론트가 그대로 라우트에 넣으면 400이 난다(실제로 겪은 버그). SQL에서
      // 바로 'YYYY-MM-DD' 문자열로 포맷해 이 문제를 없앤다.
      .addSelect(
        "DATE_FORMAT(dailyReport.REPORT_DATE, '%Y-%m-%d')",
        'reportDate',
      )
      .addSelect('notification.WEEKLY_REPORT_ID', 'weeklyReportId')
      .addSelect(
        "DATE_FORMAT(weeklyReport.START_DATE, '%Y-%m-%d')",
        'weekStart',
      )
      .where('notification.GUARDIAN_ID = :guardianId', { guardianId })
      .orderBy('notification.ALERT_ID', 'DESC')
      .take(limit);

    if (cursor !== undefined) {
      query.andWhere('notification.ALERT_ID < :cursor', { cursor });
    }

    return query.getRawMany<NotificationListRow>();
  }

  countUnread(guardianId: number): Promise<number> {
    return this.repository.countBy({ guardianId, isRead: false });
  }

  async markAsRead(alertId: number, guardianId: number): Promise<boolean> {
    // 소유자 ID까지 UPDATE 조건에 포함해 다른 보호자의 알림을 변경하지 못하게 한다.
    const result = await this.repository.update(
      { alertId, guardianId },
      { isRead: true },
    );
    if ((result.affected ?? 0) > 0) {
      return true;
    }

    // 이미 읽은 알림은 변경 행이 0건일 수 있으므로 존재하면 성공으로 취급한다.
    return this.repository.existsBy({ alertId, guardianId });
  }

  async markAsUnread(alertId: number, guardianId: number): Promise<boolean> {
    const result = await this.repository.update(
      { alertId, guardianId },
      { isRead: false },
    );
    if ((result.affected ?? 0) > 0) {
      return true;
    }

    // 이미 읽지 않은 알림은 변경 행이 0건일 수 있으므로 존재하면 성공으로 취급한다.
    return this.repository.existsBy({ alertId, guardianId });
  }

  async markAllAsRead(guardianId: number): Promise<void> {
    // 미확인 건만 갱신해 이미 읽은 알림의 상태와 생성 정보는 유지한다.
    await this.repository.update(
      { guardianId, isRead: false },
      { isRead: true },
    );
  }

  private wasInserted(raw: unknown): boolean {
    return (
      typeof raw === 'object' &&
      raw !== null &&
      'affectedRows' in raw &&
      raw.affectedRows === 1
    );
  }
}
