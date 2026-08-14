import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { PushSubscriptionsService } from './push-subscriptions.service';
import type { PushSubscriptionRepository } from './repositories/push-subscription.repository';

describe('PushSubscriptionsService', () => {
  const guardian = { sub: 10, role: UserRole.GUARDIAN };
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

  it('JWT 보호자 ID와 브라우저 구독을 저장하고 암호화 키는 응답에서 제외한다', async () => {
    const { service, repository } = createService();
    const createdAt = new Date('2026-08-14T03:00:00.000Z');
    repository.upsert.mockResolvedValue({
      subscriptionId: 1,
      guardianId: 10,
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
      guardianId: 10,
      endpoint: dto.endpoint,
      p256dhKey: dto.keys.p256dh,
      authSecret: dto.keys.auth,
      expirationTime: null,
      userAgent: 'test-agent',
    });
    expect(result).not.toHaveProperty('p256dhKey');
    expect(result).not.toHaveProperty('authSecret');
  });

  it('해제는 JWT 보호자 소유 endpoint로 제한하고 없어도 성공한다', async () => {
    const { service, repository } = createService();
    repository.deleteOwned.mockResolvedValue(undefined);

    await service.remove(guardian, { endpoint: dto.endpoint });

    expect(repository.deleteOwned).toHaveBeenCalledWith(10, dto.endpoint);
  });

  it('시니어 계정의 등록과 해제를 거부한다', async () => {
    const { service, repository } = createService();
    const senior = { sub: 9, role: UserRole.SENIOR };

    await expect(service.upsert(senior, dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.remove(senior, { endpoint: dto.endpoint }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.upsert).not.toHaveBeenCalled();
    expect(repository.deleteOwned).not.toHaveBeenCalled();
  });
});
