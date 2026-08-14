import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DeletePushSubscriptionDto,
  UpsertPushSubscriptionDto,
} from './push-subscription.dto';

describe('push subscription DTO', () => {
  const validSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-token',
    expirationTime: null,
    keys: {
      p256dh: 'BCVx_test-p256dh-key',
      auth: 'test_auth-key',
    },
  };

  it('브라우저 PushSubscription JSON을 허용한다', async () => {
    const dto = plainToInstance(UpsertPushSubscriptionDto, validSubscription);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('HTTPS가 아닌 endpoint와 잘못된 키 형식을 거부한다', async () => {
    const dto = plainToInstance(UpsertPushSubscriptionDto, {
      ...validSubscription,
      endpoint: 'http://push.example.com/test',
      keys: { p256dh: 'not valid!', auth: '' },
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('해제 요청은 endpoint만 받는다', async () => {
    const dto = plainToInstance(DeletePushSubscriptionDto, {
      endpoint: validSubscription.endpoint,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
