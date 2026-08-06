/*
역할: 리포트 기능의 Controller, Service, Entity Repository를 등록한다.
전체 흐름: AppModule → ReportsModule → ReportsController → ReportsService
*/
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyEmotionReport } from './entities/daily-emotion-report.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

// DailyEmotionReport Repository와 리포트 요청 처리 객체를 등록한다.
@Module({
  imports: [TypeOrmModule.forFeature([DailyEmotionReport])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
