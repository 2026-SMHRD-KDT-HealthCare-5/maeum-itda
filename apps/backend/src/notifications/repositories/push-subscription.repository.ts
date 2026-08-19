/* 역할: 브라우저 endpoint 기준 구독 upsert와 사용자 소유 범위 내 해제를 캡슐화한다. */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PushSubscription } from '../entities/push-subscription.entity';

export interface SavePushSubscriptionInput {
  userId: number;
  endpoint: string;
  p256dhKey: string;
  authSecret: string;
  expirationTime: number | null;
  userAgent: string | null;
}

@Injectable()
export class PushSubscriptionRepository {
  constructor(private readonly dataSource: DataSource) {}

  async upsert(input: SavePushSubscriptionInput): Promise<PushSubscription> {
    const repository = this.dataSource.getRepository(PushSubscription);
    await repository.upsert(input, {
      conflictPaths: ['endpoint'],
      skipUpdateIfNoValuesChanged: true,
    });
    return repository.findOneByOrFail({ endpoint: input.endpoint });
  }

  async deleteOwned(userId: number, endpoint: string): Promise<void> {
    await this.dataSource
      .getRepository(PushSubscription)
      .delete({ userId, endpoint });
  }

  findByUserId(userId: number): Promise<PushSubscription[]> {
    return this.dataSource
      .getRepository(PushSubscription)
      .find({ where: { userId } });
  }

  async deleteById(subscriptionId: number): Promise<void> {
    await this.dataSource
      .getRepository(PushSubscription)
      .delete({ subscriptionId });
  }
}
