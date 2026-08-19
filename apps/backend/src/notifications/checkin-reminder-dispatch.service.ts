/*
역할: 안부 알림이 켜져 있고 리마인더 시각이 지금(Asia/Seoul)과 일치하는 시니어를 찾아
웹 푸시로 대화를 권유한다.
전체 흐름: CheckinReminderScheduler(매분 실행) → CheckinReminderDispatchService → Repository<User>
조회 → WebPushDeliveryService.sendToUser
*/
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { toSeoulHourMinute } from './lib/seoul-time';
import { WebPushDeliveryService } from './web-push-delivery.service';

@Injectable()
export class CheckinReminderDispatchService {
  private readonly logger = new Logger(CheckinReminderDispatchService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly webPushDeliveryService: WebPushDeliveryService,
  ) {}

  async run(now: Date = new Date()): Promise<void> {
    const currentHourMinute = toSeoulHourMinute(now);

    const seniors = await this.usersRepository.find({
      where: {
        role: UserRole.SENIOR,
        notificationEnabled: true,
        withdrawnAt: IsNull(),
      },
    });

    const dueSeniors = seniors.filter(
      (senior) =>
        senior.checkinReminderTime !== null &&
        senior.checkinReminderTime.slice(0, 5) === currentHourMinute,
    );

    await Promise.allSettled(
      dueSeniors.map((senior) =>
        this.webPushDeliveryService
          .sendToUser(senior.userId, {
            title: '다슬이가 안부를 물어보고 싶어해요',
            body: '오늘 하루는 어떠셨어요? 잠깐 이야기 나눠요.',
            url: '/senior/conversation',
            tag: `checkin-reminder-${currentHourMinute}`,
          })
          .catch((error: unknown) => {
            this.logger.error(
              `안부 알림 푸시 발송 실패: userId=${senior.userId}`,
              error instanceof Error ? error.stack : String(error),
            );
          }),
      ),
    );
  }
}
