import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { NotificationTargetType } from './dto/notification-response.dto';
import { AlertType } from './entities/guardian-notification.entity';
import { NotificationsService } from './notifications.service';
import type { GuardianNotificationRepository } from './repositories/guardian-notification.repository';
import type { NotificationPreferenceRepository } from './repositories/notification-preference.repository';
import type { WebPushDeliveryService } from './web-push-delivery.service';

describe('NotificationsService', () => {
  const guardian = { sub: 7, role: UserRole.GUARDIAN };
  const senior = { sub: 9, role: UserRole.SENIOR };

  function createRepository() {
    return {
      findPage: jest.fn(),
      countUnread: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      saveWeeklyReportReady: jest.fn(),
      saveEmotionIndexDrop: jest.fn(),
    };
  }

  function createService(repository = createRepository()) {
    const preferenceRepository = {
      findGuardianPreference: jest.fn(),
    };
    const deliveryService = { sendToGuardian: jest.fn() };
    return {
      service: new NotificationsService(
        repository as unknown as GuardianNotificationRepository,
        preferenceRepository as unknown as NotificationPreferenceRepository,
        deliveryService as unknown as WebPushDeliveryService,
      ),
      repository,
      preferenceRepository,
      deliveryService,
    };
  }

  it('보호자의 알림을 다음 cursor와 이동 대상으로 변환한다', async () => {
    const repository = createRepository();
    repository.findPage.mockResolvedValue([
      {
        alertId: 12,
        alertType: AlertType.EMOTION_INDEX_DROP,
        content: '정서지수가 기준보다 낮아요.',
        isRead: '0',
        createdAt: new Date('2026-08-14T00:31:00.000Z'),
        dailyReportId: 31,
        reportDate: '2026-08-13',
        weeklyReportId: null,
        weekStart: null,
      },
      {
        alertId: 11,
        alertType: AlertType.WEEKLY_REPORT_READY,
        content: '주간 리포트가 준비되었어요.',
        isRead: 1,
        createdAt: new Date('2026-08-13T00:00:00.000Z'),
        dailyReportId: null,
        reportDate: null,
        weeklyReportId: 5,
        weekStart: '2026-08-03',
      },
    ]);
    repository.countUnread.mockResolvedValue(1);
    const { service } = createService(repository);

    const result = await service.getNotifications(guardian, { limit: 1 });

    expect(repository.findPage).toHaveBeenCalledWith(7, undefined, 2);
    expect(result.nextCursor).toBe(12);
    expect(result.unreadCount).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].isRead).toBe(false);
    expect(result.notifications[0].target).toEqual({
      type: NotificationTargetType.DAILY_REPORT,
      reportId: 31,
      reportDate: '2026-08-13',
      weeklyReportId: null,
      weekStart: null,
    });
  });

  it('다음 페이지가 없으면 nextCursor를 null로 반환한다', async () => {
    const repository = createRepository();
    repository.findPage.mockResolvedValue([]);
    repository.countUnread.mockResolvedValue(0);
    const { service } = createService(repository);

    const result = await service.getNotifications(guardian, { limit: 30 });

    expect(result).toEqual({
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
    });
  });

  it('시니어 계정의 알림함 접근을 거부한다', async () => {
    const repository = createRepository();
    const { service } = createService(repository);

    await expect(
      service.getNotifications(senior, { limit: 30 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findPage).not.toHaveBeenCalled();
  });

  it('본인 소유가 아닌 알림은 찾을 수 없음으로 처리한다', async () => {
    const repository = createRepository();
    repository.markAsRead.mockResolvedValue(false);
    const { service } = createService(repository);

    await expect(service.markAsRead(guardian, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.markAsRead).toHaveBeenCalledWith(99, 7);
  });

  it('보호자의 미확인 알림을 모두 읽음 처리한다', async () => {
    const repository = createRepository();
    repository.markAllAsRead.mockResolvedValue(undefined);
    const { service } = createService(repository);

    await service.markAllAsRead(guardian);

    expect(repository.markAllAsRead).toHaveBeenCalledWith(7);
  });

  it('임계치 이하의 새 일간 알림을 저장하고 푸시한다', async () => {
    const { service, repository, preferenceRepository, deliveryService } =
      createService();
    preferenceRepository.findGuardianPreference.mockResolvedValue({
      enabled: true,
      threshold: 50,
    });
    repository.saveEmotionIndexDrop.mockResolvedValue({
      created: true,
      notification: { content: '정서지수가 50점 이하예요.' },
    });

    await service.createEmotionIndexDropNotification(7, 31, '2026-08-13', 49);

    expect(repository.saveEmotionIndexDrop).toHaveBeenCalled();
    expect(deliveryService.sendToGuardian).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ url: '/guardian/report?date=2026-08-13' }),
    );
  });

  it('임계치 초과 또는 기존 알림이면 푸시를 보내지 않는다', async () => {
    const { service, repository, preferenceRepository, deliveryService } =
      createService();
    preferenceRepository.findGuardianPreference.mockResolvedValue({
      enabled: true,
      threshold: 50,
    });

    await service.createEmotionIndexDropNotification(7, 31, '2026-08-13', 51);
    expect(repository.saveEmotionIndexDrop).not.toHaveBeenCalled();

    repository.saveEmotionIndexDrop.mockResolvedValue({
      created: false,
      notification: { content: '기존 알림' },
    });
    await service.createEmotionIndexDropNotification(7, 31, '2026-08-13', 49);
    expect(deliveryService.sendToGuardian).not.toHaveBeenCalled();
  });
});
