/*
역할: 보호자 전용 알림 정책과 화면 응답 변환을 담당한다.
주의: 알림 제목과 이동 대상은 중복 저장하지 않고 유형과 연결 리포트로 계산한다.
*/
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { UserRole } from '../users/entities/user.entity';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';
import {
  NotificationItemDto,
  NotificationListResponseDto,
  NotificationTargetType,
} from './dto/notification-response.dto';
import {
  AlertType,
  GuardianNotification,
} from './entities/guardian-notification.entity';
import {
  GuardianNotificationRepository,
  NotificationListRow,
} from './repositories/guardian-notification.repository';
import { NotificationPreferenceRepository } from './repositories/notification-preference.repository';
import {
  WebPushDeliveryService,
  WebPushPayload,
} from './web-push-delivery.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationRepository: GuardianNotificationRepository,
    private readonly preferenceRepository: NotificationPreferenceRepository,
    private readonly webPushDeliveryService: WebPushDeliveryService,
  ) {}

  async getNotifications(
    auth: AccessTokenPayload,
    query: NotificationListQueryDto,
  ): Promise<NotificationListResponseDto> {
    // limit+1건을 조회해 별도 전체 개수 조회 없이 다음 페이지 존재 여부를 판단한다.
    this.requireGuardian(auth);
    const rows = await this.notificationRepository.findPage(
      auth.sub,
      query.cursor,
      query.limit + 1,
    );
    const hasNextPage = rows.length > query.limit;
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;
    const unreadCount = await this.notificationRepository.countUnread(auth.sub);

    return {
      notifications: pageRows.map((row) => this.toItemDto(row)),
      nextCursor:
        hasNextPage && pageRows.length > 0
          ? pageRows[pageRows.length - 1].alertId
          : null,
      unreadCount,
    };
  }

  async markAsRead(auth: AccessTokenPayload, alertId: number): Promise<void> {
    this.requireGuardian(auth);
    const updated = await this.notificationRepository.markAsRead(
      alertId,
      auth.sub,
    );
    if (!updated) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }
  }

  async markAllAsRead(auth: AccessTokenPayload): Promise<void> {
    this.requireGuardian(auth);
    await this.notificationRepository.markAllAsRead(auth.sub);
  }

  async createWeeklyReportReadyNotification(
    guardianId: number,
    weeklyReportId: number,
    weekStart: string,
  ): Promise<GuardianNotification> {
    const saved = await this.notificationRepository.saveWeeklyReportReady(
      guardianId,
      weeklyReportId,
      '지난주 주간 리포트가 도착했어요.',
    );
    if (saved.created) {
      await this.deliverIfEnabled(guardianId, {
        title: '주간 리포트가 완성되었어요',
        body: saved.notification.content,
        url: `/guardian/report/weekly/${weekStart}`,
        tag: `weekly-report-${weeklyReportId}`,
      });
    }
    return saved.notification;
  }

  async createEmotionIndexDropNotification(
    guardianId: number,
    dailyReportId: number,
    reportDate: string,
    emotionIndex: number,
  ): Promise<GuardianNotification | null> {
    const preference =
      await this.preferenceRepository.findGuardianPreference(guardianId);
    if (!preference || emotionIndex > preference.threshold) return null;

    const saved = await this.notificationRepository.saveEmotionIndexDrop(
      guardianId,
      dailyReportId,
      `정서지수가 설정한 ${preference.threshold}점 이하로 나타났어요.`,
    );
    if (saved.created && preference.enabled) {
      await this.webPushDeliveryService.sendToGuardian(guardianId, {
        title: '정서지수 하락이 감지되었어요',
        body: saved.notification.content,
        url: `/guardian/report?date=${reportDate}`,
        tag: `daily-report-${dailyReportId}`,
      });
    }
    return saved.notification;
  }

  private async deliverIfEnabled(
    guardianId: number,
    payload: WebPushPayload,
  ): Promise<void> {
    const preference =
      await this.preferenceRepository.findGuardianPreference(guardianId);
    if (preference?.enabled) {
      await this.webPushDeliveryService.sendToGuardian(guardianId, payload);
    }
  }

  private requireGuardian(auth: AccessTokenPayload): void {
    if (auth.role !== UserRole.GUARDIAN) {
      throw new ForbiddenException(
        '보호자 계정에서만 알림을 확인할 수 있습니다.',
      );
    }
  }

  private toItemDto(row: NotificationListRow): NotificationItemDto {
    if (row.alertType === AlertType.EMOTION_INDEX_DROP) {
      return {
        alertId: row.alertId,
        type: row.alertType,
        title: '정서지수 하락 감지',
        content: row.content,
        isRead: this.toBoolean(row.isRead),
        createdAt: row.createdAt,
        target: {
          type: NotificationTargetType.DAILY_REPORT,
          reportId: row.dailyReportId,
          reportDate: row.reportDate,
          weeklyReportId: null,
          weekStart: null,
        },
      };
    }

    return {
      alertId: row.alertId,
      type: row.alertType,
      title: '주간 리포트가 도착했어요',
      content: row.content,
      isRead: this.toBoolean(row.isRead),
      createdAt: row.createdAt,
      target: {
        type: NotificationTargetType.WEEKLY_REPORT,
        reportId: null,
        reportDate: null,
        weeklyReportId: row.weeklyReportId,
        weekStart: row.weekStart,
      },
    };
  }

  private toBoolean(value: boolean | number | string): boolean {
    return value === true || value === 1 || value === '1';
  }
}
