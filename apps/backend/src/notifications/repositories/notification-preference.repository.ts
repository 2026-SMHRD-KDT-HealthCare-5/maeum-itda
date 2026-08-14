/* 역할: 실제 푸시 여부와 일간 위험 임계치 판단에 필요한 보호자 알림 설정만 조회한다. */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface GuardianNotificationPreference {
  enabled: boolean;
  threshold: number;
}

@Injectable()
export class NotificationPreferenceRepository {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findGuardianPreference(
    guardianId: number,
  ): Promise<GuardianNotificationPreference | null> {
    const user = await this.usersRepository.findOne({
      where: { userId: guardianId },
      select: {
        notificationEnabled: true,
        emotionAlertThreshold: true,
      },
    });
    if (!user) return null;
    return {
      enabled: user.notificationEnabled,
      threshold: user.emotionAlertThreshold ?? 50,
    };
  }
}
