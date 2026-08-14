/* 역할: 브라우저 endpoint 기준 구독 upsert와 보호자 소유 범위 내 해제를 캡슐화한다. */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PushSubscription } from '../entities/push-subscription.entity';

export interface SavePushSubscriptionInput {
  guardianId: number;
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

  async deleteOwned(guardianId: number, endpoint: string): Promise<void> {
    await this.dataSource
      .getRepository(PushSubscription)
      .delete({ guardianId, endpoint });
  }

  findByGuardianId(guardianId: number): Promise<PushSubscription[]> {
    return this.dataSource
      .getRepository(PushSubscription)
      .find({ where: { guardianId } });
  }

  async deleteById(subscriptionId: number): Promise<void> {
    await this.dataSource
      .getRepository(PushSubscription)
      .delete({ subscriptionId });
  }
}
