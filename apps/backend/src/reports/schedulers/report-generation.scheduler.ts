/* 역할: 매일 오전 9시(Asia/Seoul)에 검증된 리포트 생성 조정 서비스를 호출한다. */
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportGenerationCoordinatorService } from '../report-generation-coordinator.service';

@Injectable()
export class ReportGenerationScheduler {
  constructor(
    private readonly coordinator: ReportGenerationCoordinatorService,
  ) {}

  @Cron('0 0 9 * * *', {
    name: 'daily-and-weekly-report-generation',
    timeZone: 'Asia/Seoul',
    waitForCompletion: true,
  })
  run(): Promise<void> {
    return this.coordinator.run();
  }
}
