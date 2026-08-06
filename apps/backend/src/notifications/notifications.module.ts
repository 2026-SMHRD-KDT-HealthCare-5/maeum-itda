/*
역할: 알림 기능의 Controller, Service, Entity Repository를 등록한다.
전체 흐름: AppModule → NotificationsModule → NotificationsController → NotificationsService
*/
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardianRiskAlert } from './entities/guardian-risk-alert.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// GuardianRiskAlert Repository와 알림 요청 처리 객체를 등록한다.
@Module({
  imports: [TypeOrmModule.forFeature([GuardianRiskAlert])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
