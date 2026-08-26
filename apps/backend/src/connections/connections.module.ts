/* 역할: 연결 관리 Controller·Service와 관계/사용자 Repository, JWT Guard를 조립한다. */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GuardianSeniorRelationship } from '../users/entities/guardian-senior-relationship.entity';
import { User } from '../users/entities/user.entity';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { ConnectionsRepository } from './repositories/connections.repository';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    TypeOrmModule.forFeature([GuardianSeniorRelationship, User]),
  ],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, ConnectionsRepository],
})
export class ConnectionsModule {}
