/* 역할: 회원가입 화면과 백엔드의 아이디·비밀번호 입력 규칙이 일치하는지 검증한다. */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';
import { CheckLoginIdDto } from './check-login-id.dto';
import { SignUpDto } from './sign-up.dto';

describe('회원가입 입력 규칙', () => {
  function createDto(overrides: Partial<SignUpDto> = {}): SignUpDto {
    return plainToInstance(SignUpDto, {
      loginId: 'user01',
      password: '1234',
      passwordConfirm: '1234',
      name: '홍길동',
      phone: '010-1234-5678',
      role: UserRole.SENIOR,
      termsAgreed: true,
      ...overrides,
    });
  }

  it('영문·숫자 4~20자 아이디와 4자 비밀번호를 허용한다', async () => {
    await expect(validate(createDto())).resolves.toHaveLength(0);
  });

  it.each(['abc', 'user_name', '가나다라', 'a'.repeat(21)])(
    '회원가입에서 올바르지 않은 아이디 %s를 거절한다',
    async (loginId) => {
      const errors = await validate(createDto({ loginId }));
      expect(errors.some((error) => error.property === 'loginId')).toBe(true);
    },
  );

  it('4자 미만 비밀번호를 거절한다', async () => {
    const errors = await validate(
      createDto({ password: '123', passwordConfirm: '123' }),
    );
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('아이디 중복 확인에도 영문·숫자 4~20자 규칙을 적용한다', async () => {
    const dto = plainToInstance(CheckLoginIdDto, { loginId: 'user_name' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'loginId')).toBe(true);
  });
});
