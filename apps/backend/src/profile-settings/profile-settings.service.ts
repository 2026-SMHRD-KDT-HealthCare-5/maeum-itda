/*
역할: 인증 사용자의 역할을 검증하고 USERS 테이블의 역할별 알림 설정을 조회·수정한다.
전체 흐름: ProfileSettingsController → ProfileSettingsService → Repository<User> → MySQL USERS
*/
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AccessTokenPayload } from '../auth/auth.service';
import { User, UserRole } from '../users/entities/user.entity';
import { UpdateGuardianAlertSettingDto } from './dto/guardian-alert-setting.dto';
import { UpdateSeniorCheckinSettingDto } from './dto/senior-checkin-setting.dto';

@Injectable()
export class ProfileSettingsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getGuardianAlertSetting(auth: AccessTokenPayload) {
    const user = await this.getUserForRole(auth, UserRole.GUARDIAN);
    return {
      enabled: user.notificationEnabled,
      threshold: user.emotionAlertThreshold ?? 50,
    };
  }

  async updateGuardianAlertSetting(
    auth: AccessTokenPayload,
    dto: UpdateGuardianAlertSettingDto,
  ) {
    const user = await this.getUserForRole(auth, UserRole.GUARDIAN);
    if (dto.enabled !== undefined) user.notificationEnabled = dto.enabled;
    if (dto.threshold !== undefined) user.emotionAlertThreshold = dto.threshold;
    const saved = await this.usersRepository.save(user);
    return {
      enabled: saved.notificationEnabled,
      threshold: saved.emotionAlertThreshold ?? 50,
    };
  }

  async getSeniorCheckinSetting(auth: AccessTokenPayload) {
    const user = await this.getUserForRole(auth, UserRole.SENIOR);
    return {
      enabled: user.notificationEnabled,
      time: this.toHourMinute(user.checkinReminderTime ?? '09:00:00'),
    };
  }

  async updateSeniorCheckinSetting(
    auth: AccessTokenPayload,
    dto: UpdateSeniorCheckinSettingDto,
  ) {
    const user = await this.getUserForRole(auth, UserRole.SENIOR);
    if (dto.enabled !== undefined) user.notificationEnabled = dto.enabled;
    if (dto.time !== undefined) user.checkinReminderTime = `${dto.time}:00`;
    const saved = await this.usersRepository.save(user);
    return {
      enabled: saved.notificationEnabled,
      time: this.toHourMinute(saved.checkinReminderTime ?? '09:00:00'),
    };
  }

  private async getUserForRole(auth: AccessTokenPayload, role: UserRole) {
    if (auth.role !== role) {
      throw new ForbiddenException('해당 역할에서 사용할 수 없는 설정입니다.');
    }

    const user = await this.usersRepository.findOne({
      where: { userId: auth.sub },
    });
    if (!user || user.withdrawnAt !== null) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return user;
  }

  private toHourMinute(time: string): string {
    return time.slice(0, 5);
  }
}
