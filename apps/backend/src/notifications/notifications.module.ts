/*
역할: 알림 기능의 Controller, Service, Entity Repository를 등록한다.
전체 흐름: AppModule → NotificationsModule → NotificationsController → NotificationsService
*/
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { GuardianNotification } from './entities/guardian-notification.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { GuardianNotificationRepository } from './repositories/guardian-notification.repository';
import { PushSubscriptionRepository } from './repositories/push-subscription.repository';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { NotificationPreferenceRepository } from './repositories/notification-preference.repository';
import { WebPushDeliveryService } from './web-push-delivery.service';

// GuardianNotification Repository와 알림 요청 처리 객체를 등록한다.
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([GuardianNotification, PushSubscription, User]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushSubscriptionsService,
    WebPushDeliveryService,
    GuardianNotificationRepository,
    NotificationPreferenceRepository,
    PushSubscriptionRepository,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
