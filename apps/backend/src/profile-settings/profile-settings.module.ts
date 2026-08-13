/* 역할: 역할별 프로필 알림 설정 Controller·Service·Repository를 조립한다. */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { ProfileSettingsController } from './profile-settings.controller';
import { ProfileSettingsService } from './profile-settings.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  controllers: [ProfileSettingsController],
  providers: [ProfileSettingsService],
})
export class ProfileSettingsModule {}
