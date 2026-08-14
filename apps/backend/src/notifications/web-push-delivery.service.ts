/* 역할: 보호자의 모든 브라우저 구독으로 실제 Web Push를 보내고 만료 endpoint를 정리한다. */
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webPush, { WebPushError } from 'web-push';
import type { WebPushConfig } from '../config/web-push.config';
import { PushSubscriptionRepository } from './repositories/push-subscription.repository';

export interface WebPushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

@Injectable()
export class WebPushDeliveryService {
  private readonly logger = new Logger(WebPushDeliveryService.name);
  private readonly config: WebPushConfig;

  constructor(
    configService: ConfigService,
    private readonly subscriptionRepository: PushSubscriptionRepository,
  ) {
    this.config = configService.getOrThrow<WebPushConfig>('webPush');
    if (this.isConfigured()) {
      webPush.setVapidDetails(
        this.config.subject,
        this.config.publicKey,
        this.config.privateKey,
      );
    }
  }

  getPublicKey(): string {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        '웹 푸시 VAPID 키가 설정되지 않았습니다.',
      );
    }
    return this.config.publicKey;
  }

  async sendToGuardian(
    guardianId: number,
    payload: WebPushPayload,
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('VAPID 키가 없어 웹 푸시 발송을 건너뜁니다.');
      return;
    }

    const subscriptions =
      await this.subscriptionRepository.findByGuardianId(guardianId);
    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              expirationTime: subscription.expirationTime,
              keys: {
                p256dh: subscription.p256dhKey,
                auth: subscription.authSecret,
              },
            },
            JSON.stringify(payload),
            { TTL: 86_400 },
          );
        } catch (error: unknown) {
          if (this.isExpiredSubscription(error)) {
            await this.subscriptionRepository.deleteById(
              subscription.subscriptionId,
            );
            return;
          }
          this.logger.error(
            `웹 푸시 발송 실패: guardianId=${guardianId}, subscriptionId=${subscription.subscriptionId}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }),
    );
  }

  private isConfigured(): boolean {
    return Boolean(this.config.publicKey && this.config.privateKey);
  }

  private isExpiredSubscription(error: unknown): boolean {
    if (!(error instanceof WebPushError)) return false;
    return error.statusCode === 404 || error.statusCode === 410;
  }
}
