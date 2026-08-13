/* 역할: 회원가입·내 정보 수정 DTO가 하이픈을 허용하고 숫자 저장 형식으로 변환하는지 검증한다. */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignUpDto } from '../auth/dto/sign-up.dto';
import { UserRole } from './entities/user.entity';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

describe('휴대폰 번호 DTO 변환', () => {
  it('회원가입 번호의 하이픈을 제거한 뒤 검증한다', async () => {
    const dto = plainToInstance(SignUpDto, {
      loginId: 'senior01',
      password: 'password123!',
      passwordConfirm: 'password123!',
      name: '김순자',
      phone: '010-1234-5678',
      role: UserRole.SENIOR,
      termsAgreed: true,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.phone).toBe('01012345678');
  });

  it('내 정보 수정 번호의 하이픈을 제거한 뒤 검증한다', async () => {
    const dto = plainToInstance(UpdateMyProfileDto, {
      phone: '010-9876-5432',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.phone).toBe('01098765432');
  });

  it('하이픈 외 문자가 포함된 번호는 거절한다', async () => {
    const dto = plainToInstance(UpdateMyProfileDto, {
      phone: '전화010-1234-5678',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
