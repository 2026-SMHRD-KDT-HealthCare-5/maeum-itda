/* 역할: 보호자 권한을 검증하고 웹 푸시 구독 등록·갱신·해제를 처리한다. */
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.service';
import { UserRole } from '../users/entities/user.entity';
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
    this.requireGuardian(auth);
    const subscription = await this.pushSubscriptionRepository.upsert({
      guardianId: auth.sub,
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
    this.requireGuardian(auth);
    // 이미 삭제됐거나 다른 보호자의 endpoint여도 204로 처리해 정보 노출 없이 멱등성을 유지한다.
    await this.pushSubscriptionRepository.deleteOwned(auth.sub, dto.endpoint);
  }

  private requireGuardian(auth: AccessTokenPayload): void {
    if (auth.role !== UserRole.GUARDIAN) {
      throw new ForbiddenException(
        '보호자 계정에서만 웹 푸시를 구독할 수 있습니다.',
      );
    }
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
