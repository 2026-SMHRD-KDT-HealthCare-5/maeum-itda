/* 역할: 보호자 대시보드 Controller, Service, Repository와 인증·DB 의존성을 연결한다. */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConversationMessage } from '../chats/entities/conversation-message.entity';
import { DailyEmotionReport } from '../reports/entities/daily-emotion-report.entity';
import { GuardianSeniorRelationship } from '../users/entities/guardian-senior-relationship.entity';
import { User } from '../users/entities/user.entity';
import { GuardianDashboardController } from './guardian-dashboard.controller';
import { GuardianDashboardService } from './guardian-dashboard.service';
import { GuardianDashboardRepository } from './repositories/guardian-dashboard.repository';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      User,
      GuardianSeniorRelationship,
      ConversationMessage,
      DailyEmotionReport,
    ]),
  ],
  controllers: [GuardianDashboardController],
  providers: [GuardianDashboardService, GuardianDashboardRepository],
})
export class GuardianDashboardModule {}
