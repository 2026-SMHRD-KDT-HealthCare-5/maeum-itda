import type { Repository } from 'typeorm';
import { GuardianNotification } from '../entities/guardian-notification.entity';
import { GuardianNotificationRepository } from './guardian-notification.repository';

describe('GuardianNotificationRepository', () => {
  it('이미 읽은 본인 알림도 읽음 처리 성공으로 판단한다', async () => {
    const typeOrmRepository = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      existsBy: jest.fn().mockResolvedValue(true),
    };
    const repository = new GuardianNotificationRepository(
      typeOrmRepository as unknown as Repository<GuardianNotification>,
    );

    await expect(repository.markAsRead(12, 7)).resolves.toBe(true);
    expect(typeOrmRepository.existsBy).toHaveBeenCalledWith({
      alertId: 12,
      guardianId: 7,
    });
  });

  it('본인 소유가 아닌 알림은 읽음 처리 실패로 판단한다', async () => {
    const typeOrmRepository = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      existsBy: jest.fn().mockResolvedValue(false),
    };
    const repository = new GuardianNotificationRepository(
      typeOrmRepository as unknown as Repository<GuardianNotification>,
    );

    await expect(repository.markAsRead(99, 7)).resolves.toBe(false);
  });

  it('이미 읽지 않은 본인 알림도 읽지 않음 처리 성공으로 판단한다', async () => {
    const typeOrmRepository = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      existsBy: jest.fn().mockResolvedValue(true),
    };
    const repository = new GuardianNotificationRepository(
      typeOrmRepository as unknown as Repository<GuardianNotification>,
    );

    await expect(repository.markAsUnread(12, 7)).resolves.toBe(true);
    expect(typeOrmRepository.existsBy).toHaveBeenCalledWith({
      alertId: 12,
      guardianId: 7,
    });
  });

  it('본인 소유가 아닌 알림은 읽지 않음 처리 실패로 판단한다', async () => {
    const typeOrmRepository = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      existsBy: jest.fn().mockResolvedValue(false),
    };
    const repository = new GuardianNotificationRepository(
      typeOrmRepository as unknown as Repository<GuardianNotification>,
    );

    await expect(repository.markAsUnread(99, 7)).resolves.toBe(false);
  });
});
