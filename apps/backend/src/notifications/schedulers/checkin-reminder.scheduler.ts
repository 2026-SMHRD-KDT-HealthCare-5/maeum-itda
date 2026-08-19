/* 역할: 매분 정각(Asia/Seoul)에 안부 알림 리마인더 대상 시니어를 확인해 웹 푸시를 발송한다. */
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CheckinReminderDispatchService } from '../checkin-reminder-dispatch.service';

@Injectable()
export class CheckinReminderScheduler {
  constructor(
    private readonly dispatchService: CheckinReminderDispatchService,
  ) {}

  @Cron('0 * * * * *', {
    name: 'senior-checkin-reminder-dispatch',
    timeZone: 'Asia/Seoul',
    waitForCompletion: true,
  })
  run(): Promise<void> {
    return this.dispatchService.run();
  }
}
