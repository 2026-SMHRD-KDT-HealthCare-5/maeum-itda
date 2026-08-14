/*
역할: 실제 DB 없이 AuthService의 회원가입 업무 규칙을 단위 테스트한다.
전체 흐름: Jest → AuthService → 가짜 UsersService
*/
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';

describe('AuthService', () => {
  // DB에 연결하지 않도록 UsersService 메서드를 Jest 가짜 함수로 대체한다.
  const usersService = {
    findByLoginId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const jwtService = { verifyAsync: jest.fn(), signAsync: jest.fn() };
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

  it('로그인 정보가 일치하면 사용자 정보와 Access Token을 반환한다', async () => {
    const passwordHash = await hash('password123!', 10);
    usersService.findByLoginId.mockResolvedValue({
      userId: 1,
      loginId: 'user1234',
      passwordHash,
      name: '홍길동',
      phone: '01012345678',
      role: UserRole.SENIOR,
      joinedAt: new Date('2026-08-13T00:00:00.000Z'),
      withdrawnAt: null,
    });
    jwtService.signAsync.mockResolvedValue('access-token');

    const result = await authService.login({
      loginId: 'user1234',
      password: 'password123!',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 1,
      role: UserRole.SENIOR,
    });
    expect(result.accessToken).toBe('access-token');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('비밀번호가 다르면 로그인에 실패한다', async () => {
    usersService.findByLoginId.mockResolvedValue({
      passwordHash: await hash('password123!', 10),
      withdrawnAt: null,
    });

    await expect(
      authService.login({ loginId: 'user1234', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('탈퇴한 회원의 기존 Access Token을 거절한다', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 1,
      role: UserRole.SENIOR,
    });
    usersService.findById.mockResolvedValue({
      userId: 1,
      role: UserRole.SENIOR,
      withdrawnAt: new Date(),
    });

    await expect(
      authService.verifyAccessToken('withdrawn-user-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

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
          notificationEnabled: true,
          emotionAlertThreshold: data.role === UserRole.GUARDIAN ? 50 : null,
          checkinReminderTime:
            data.role === UserRole.SENIOR ? '09:00:00' : null,
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
