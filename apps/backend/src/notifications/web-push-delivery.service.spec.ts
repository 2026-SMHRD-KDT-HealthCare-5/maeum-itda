import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import webPush, { WebPushError } from 'web-push';
import type { PushSubscriptionRepository } from './repositories/push-subscription.repository';
import { WebPushDeliveryService } from './web-push-delivery.service';

jest.mock('web-push', () => {
  class MockWebPushError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
    }
  }
  return {
    __esModule: true,
    default: {
      setVapidDetails: jest.fn(),
      sendNotification: jest.fn(),
    },
    WebPushError: MockWebPushError,
  };
});

describe('WebPushDeliveryService', () => {
  const payload = {
    title: '알림',
    body: '내용',
    url: '/guardian/report',
    tag: 'daily-report-1',
  };

  function createService(configured = true) {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue({
        subject: 'mailto:test@example.com',
        publicKey: configured ? 'public-key' : '',
        privateKey: configured ? 'private-key' : '',
      }),
    };
    const repository = {
      findByGuardianId: jest.fn(),
      deleteById: jest.fn(),
    };
    return {
      service: new WebPushDeliveryService(
        configService as unknown as ConfigService,
        repository as unknown as PushSubscriptionRepository,
      ),
      repository,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('보호자의 모든 브라우저 구독으로 payload를 전송한다', async () => {
    const { service, repository } = createService();
    repository.findByGuardianId.mockResolvedValue([
      {
        subscriptionId: 1,
        endpoint: 'https://push.example.com/1',
        expirationTime: null,
        p256dhKey: 'p256dh',
        authSecret: 'auth',
      },
    ]);
    jest.mocked(webPush.sendNotification).mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });

    await service.sendToGuardian(10, payload);

    expect(webPush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example.com/1' }),
      JSON.stringify(payload),
      { TTL: 86_400 },
    );
  });

  it('Push Service가 410을 반환한 만료 구독을 삭제한다', async () => {
    const { service, repository } = createService();
    repository.findByGuardianId.mockResolvedValue([
      {
        subscriptionId: 1,
        endpoint: 'https://push.example.com/expired',
        expirationTime: null,
        p256dhKey: 'p256dh',
        authSecret: 'auth',
      },
    ]);
    jest
      .mocked(webPush.sendNotification)
      .mockRejectedValue(
        new WebPushError(
          'gone',
          410,
          {},
          '',
          'https://push.example.com/expired',
        ),
      );

    await service.sendToGuardian(10, payload);

    expect(repository.deleteById).toHaveBeenCalledWith(1);
  });

  it('VAPID 키가 없으면 공개키 요청은 503이고 발송은 건너뛴다', async () => {
    const { service, repository } = createService(false);

    expect(() => service.getPublicKey()).toThrow(ServiceUnavailableException);
    await service.sendToGuardian(10, payload);

    expect(repository.findByGuardianId).not.toHaveBeenCalled();
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });
});
