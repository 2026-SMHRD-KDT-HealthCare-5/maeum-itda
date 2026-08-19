/*
역할: 웹 푸시 구독 등록·갱신·해제를 처리한다.
보호자(정서지수 하락 알림)와 시니어(안부 알림 리마인더) 둘 다 이 기기 구독을 쓴다 —
역할 제한 없이 인증된 사용자 본인의 구독만 등록/해제한다.
*/
import { Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import {
  DeletePushSubscriptionDto,
  PushSubscriptionResponseDto,
  UpsertPushSubscriptionDto,
} from './dto/push-subscription.dto';
import { PushSubscription } from './entities/push-subscription.entity';
import { PushSubscriptionRepository } from './repositories/push-subscription.repository';

@Injectable()
export class PushSubscriptionsService {
  constructor(
    private readonly pushSubscriptionRepository: PushSubscriptionRepository,
  ) {}

  async upsert(
    auth: AccessTokenPayload,
    dto: UpsertPushSubscriptionDto,
    userAgent?: string,
  ): Promise<PushSubscriptionResponseDto> {
    const subscription = await this.pushSubscriptionRepository.upsert({
      userId: auth.sub,
      endpoint: dto.endpoint,
      p256dhKey: dto.keys.p256dh,
      authSecret: dto.keys.auth,
      expirationTime: dto.expirationTime ?? null,
      userAgent: userAgent?.slice(0, 500) ?? null,
    });
    return this.toResponse(subscription);
  }

  async remove(
    auth: AccessTokenPayload,
    dto: DeletePushSubscriptionDto,
  ): Promise<void> {
    // 이미 삭제됐거나 다른 사용자의 endpoint여도 204로 처리해 정보 노출 없이 멱등성을 유지한다.
    await this.pushSubscriptionRepository.deleteOwned(auth.sub, dto.endpoint);
  }

  private toResponse(
    subscription: PushSubscription,
  ): PushSubscriptionResponseDto {
    return {
      subscriptionId: subscription.subscriptionId,
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}
