/*
역할: 실제 DB 없이 AuthService의 회원가입 업무 규칙을 단위 테스트한다.
전체 흐름: Jest → AuthService → 가짜 UsersService
*/
import { BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';

describe('AuthService', () => {
  // DB에 연결하지 않도록 UsersService 메서드를 Jest 가짜 함수로 대체한다.
  const usersService = {
    findByLoginId: jest.fn(),
    create: jest.fn(),
  };
  const jwtService = { verifyAsync: jest.fn() };
  const authService = new AuthService(
    usersService as unknown as UsersService,
    jwtService as unknown as JwtService,
  );

  const dto: SignUpDto = {
    loginId: 'user1234',
    password: 'password123!',
    passwordConfirm: 'password123!',
    name: '홍길동',
    phone: '01012345678',
    role: UserRole.SENIOR,
    termsAgreed: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('비밀번호를 해시한 뒤 회원을 생성한다', async () => {
    let savedPasswordHash = '';
    usersService.findByLoginId.mockResolvedValue(null);
    usersService.create.mockImplementation(
      (data: {
        loginId: string;
        passwordHash: string;
        name: string;
        phone: string;
        role: UserRole;
      }) => {
        savedPasswordHash = data.passwordHash;
        return Promise.resolve({
          ...data,
          userId: 1,
          joinedAt: new Date('2026-08-04T00:00:00.000Z'),
          checkInAlarmTime: null,
          withdrawnAt: null,
        } as User);
      },
    );

    const result = await authService.signUp(dto);

    expect(result).not.toHaveProperty('passwordHash');
    expect(await compare(dto.password, savedPasswordHash)).toBe(true);
  });

  it('비밀번호 확인이 다르면 가입을 거절한다', async () => {
    await expect(
      authService.signUp({ ...dto, passwordConfirm: 'different123!' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('이미 사용 중인 아이디면 가입을 거절한다', async () => {
    usersService.findByLoginId.mockResolvedValue({ userId: 1 });

    await expect(authService.signUp(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
