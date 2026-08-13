/* 역할: USERS 컬럼 기반 역할별 알림 설정의 조회·수정·권한 제한을 검증한다. */
import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { ProfileSettingsService } from './profile-settings.service';

describe('ProfileSettingsService', () => {
  const usersRepository = { findOne: jest.fn(), save: jest.fn() };
  const service = new ProfileSettingsService(
    usersRepository as unknown as Repository<User>,
  );
  const guardianAuth = { sub: 10, role: UserRole.GUARDIAN };
  const seniorAuth = { sub: 9, role: UserRole.SENIOR };

  const guardian = {
    userId: 10,
    role: UserRole.GUARDIAN,
    notificationEnabled: true,
    emotionAlertThreshold: 50,
    checkinReminderTime: null,
    withdrawnAt: null,
  } as User;
  const senior = {
    userId: 9,
    role: UserRole.SENIOR,
    notificationEnabled: true,
    emotionAlertThreshold: null,
    checkinReminderTime: '09:00:00',
    withdrawnAt: null,
  } as User;

  beforeEach(() => jest.clearAllMocks());

  it('보호자의 알림 여부와 임계치를 USERS에서 조회한다', async () => {
    usersRepository.findOne.mockResolvedValue({ ...guardian });
    await expect(
      service.getGuardianAlertSetting(guardianAuth),
    ).resolves.toEqual({
      enabled: true,
      threshold: 50,
    });
  });

  it('보호자의 알림 여부와 0~100 임계치를 USERS에 저장한다', async () => {
    const user = { ...guardian };
    usersRepository.findOne.mockResolvedValue(user);
    usersRepository.save.mockImplementation((value) => Promise.resolve(value));
    await expect(
      service.updateGuardianAlertSetting(guardianAuth, {
        enabled: false,
        threshold: 100,
      }),
    ).resolves.toEqual({ enabled: false, threshold: 100 });
  });

  it('시니어의 알림 여부와 시간을 USERS에서 조회한다', async () => {
    usersRepository.findOne.mockResolvedValue({ ...senior });
    await expect(service.getSeniorCheckinSetting(seniorAuth)).resolves.toEqual({
      enabled: true,
      time: '09:00',
    });
  });

  it('시니어의 알림 여부와 시간을 USERS에 저장한다', async () => {
    const user = { ...senior };
    usersRepository.findOne.mockResolvedValue(user);
    usersRepository.save.mockImplementation((value) => Promise.resolve(value));
    await expect(
      service.updateSeniorCheckinSetting(seniorAuth, {
        enabled: false,
        time: '18:00',
      }),
    ).resolves.toEqual({ enabled: false, time: '18:00' });
    expect(user.checkinReminderTime).toBe('18:00:00');
  });

  it('시니어는 보호자 알림 설정을 사용할 수 없다', async () => {
    await expect(
      service.getGuardianAlertSetting(seniorAuth),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('보호자는 시니어 안부 알림 설정을 사용할 수 없다', async () => {
    await expect(
      service.getSeniorCheckinSetting(guardianAuth),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
