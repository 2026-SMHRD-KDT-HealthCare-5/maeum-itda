import { UserRole } from '../users/entities/user.entity';
import { PushSubscriptionsService } from './push-subscriptions.service';
import type { PushSubscriptionRepository } from './repositories/push-subscription.repository';

describe('PushSubscriptionsService', () => {
  const guardian = { sub: 10, role: UserRole.GUARDIAN };
  const senior = { sub: 9, role: UserRole.SENIOR };
  const dto = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-token',
    expirationTime: null,
    keys: { p256dh: 'p256dh_test', auth: 'auth_test' },
  };

  function createService() {
    const repository = {
      upsert: jest.fn(),
      deleteOwned: jest.fn(),
    };
    return {
      service: new PushSubscriptionsService(
        repository as unknown as PushSubscriptionRepository,
      ),
      repository,
    };
  }

  it('JWT 사용자 ID와 브라우저 구독을 저장하고 암호화 키는 응답에서 제외한다', async () => {
    const { service, repository } = createService();
    const createdAt = new Date('2026-08-14T03:00:00.000Z');
    repository.upsert.mockResolvedValue({
      subscriptionId: 1,
      userId: 10,
      endpoint: dto.endpoint,
      p256dhKey: dto.keys.p256dh,
      authSecret: dto.keys.auth,
      expirationTime: null,
      userAgent: 'test-agent',
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.upsert(guardian, dto, 'test-agent');

    expect(repository.upsert).toHaveBeenCalledWith({
      userId: 10,
      endpoint: dto.endpoint,
      p256dhKey: dto.keys.p256dh,
      authSecret: dto.keys.auth,
      expirationTime: null,
      userAgent: 'test-agent',
    });
    expect(result).not.toHaveProperty('p256dhKey');
    expect(result).not.toHaveProperty('authSecret');
  });

  it('해제는 JWT 사용자 소유 endpoint로 제한하고 없어도 성공한다', async () => {
    const { service, repository } = createService();
    repository.deleteOwned.mockResolvedValue(undefined);

    await service.remove(guardian, { endpoint: dto.endpoint });

    expect(repository.deleteOwned).toHaveBeenCalledWith(10, dto.endpoint);
  });

  it('시니어 계정도 안부 알림 리마인더용으로 등록·해제할 수 있다', async () => {
    const { service, repository } = createService();
    repository.upsert.mockResolvedValue({
      subscriptionId: 2,
      userId: senior.sub,
      endpoint: dto.endpoint,
      p256dhKey: dto.keys.p256dh,
      authSecret: dto.keys.auth,
      expirationTime: null,
      userAgent: null,
      createdAt: new Date('2026-08-14T03:00:00.000Z'),
      updatedAt: new Date('2026-08-14T03:00:00.000Z'),
    });
    repository.deleteOwned.mockResolvedValue(undefined);

    await service.upsert(senior, dto);
    await service.remove(senior, { endpoint: dto.endpoint });

    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: senior.sub }),
    );
    expect(repository.deleteOwned).toHaveBeenCalledWith(
      senior.sub,
      dto.endpoint,
    );
  });
});
