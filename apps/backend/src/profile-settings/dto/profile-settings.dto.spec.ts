/* 역할: 역할별 알림 설정 DTO의 임계치와 시간 입력 검증을 확인한다. */
import { validate } from 'class-validator';
import { UpdateGuardianAlertSettingDto } from './guardian-alert-setting.dto';
import { UpdateSeniorCheckinSettingDto } from './senior-checkin-setting.dto';

describe('Profile settings DTO', () => {
  it('보호자 임계치는 0~100 정수만 허용한다', async () => {
    const dto = new UpdateGuardianAlertSettingDto();
    dto.threshold = 101;

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('시니어 알림 시간은 HH:mm 형식만 허용한다', async () => {
    const dto = new UpdateSeniorCheckinSettingDto();
    dto.time = '9:00';

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('유효한 역할별 설정값을 허용한다', async () => {
    const guardianDto = new UpdateGuardianAlertSettingDto();
    guardianDto.enabled = true;
    guardianDto.threshold = 50;
    const seniorDto = new UpdateSeniorCheckinSettingDto();
    seniorDto.enabled = true;
    seniorDto.time = '09:00';

    await expect(validate(guardianDto)).resolves.toHaveLength(0);
    await expect(validate(seniorDto)).resolves.toHaveLength(0);
  });
});
