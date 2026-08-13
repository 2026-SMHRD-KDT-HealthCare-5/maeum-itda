/* 역할: 회원 조회·수정·소프트 탈퇴가 USERS Repository에 올바르게 반영되는지 검증한다. */
import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const repository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const service = new UsersService(repository as unknown as Repository<User>);

  const activeUser: User = {
    userId: 1,
    loginId: 'senior01',
    passwordHash: 'secret-hash',
    name: '김순자',
    phone: '01012345678',
    role: UserRole.SENIOR,
    notificationEnabled: true,
    emotionAlertThreshold: null,
    checkinReminderTime: '09:00:00',
    joinedAt: new Date('2026-08-13T00:00:00.000Z'),
    withdrawnAt: null,
  };

  beforeEach(() => jest.clearAllMocks());

  it('내 정보에서 비밀번호 해시를 제외한다', async () => {
    repository.findOne.mockResolvedValue({ ...activeUser });

    const result = await service.getActiveProfile(1);

    expect(repository.findOne).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.loginId).toBe('senior01');
  });

  it('이름과 휴대폰 번호만 수정해 저장한다', async () => {
    repository.findOne.mockResolvedValue({ ...activeUser });
    repository.save.mockImplementation((user: User) => Promise.resolve(user));

    const result = await service.updateActiveProfile(1, {
      name: '김순자 수정',
      phone: '010-9876-5432',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        name: '김순자 수정',
        phone: '01098765432',
      }),
    );
    expect(result.name).toBe('김순자 수정');
    expect(result.phone).toBe('01098765432');
  });

  it('회원가입용 사용자 생성에서도 휴대폰 번호를 숫자로 저장한다', async () => {
    repository.create.mockImplementation((data: Partial<User>) => data);
    repository.save.mockImplementation((user: User) => Promise.resolve(user));

    await service.create({
      loginId: 'senior02',
      passwordHash: 'secret-hash',
      name: '홍길동',
      phone: '010-1111-2222',
      role: UserRole.SENIOR,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '01011112222' }),
    );
  });

  it('회원 탈퇴 시 행을 삭제하지 않고 withdrawnAt을 기록한다', async () => {
    let savedUser: User | undefined;
    repository.findOne.mockResolvedValue({ ...activeUser });
    repository.save.mockImplementation((user: User) => {
      savedUser = user;
      return Promise.resolve(user);
    });

    await service.withdraw(1);

    expect(savedUser?.userId).toBe(1);
    expect(savedUser?.withdrawnAt).toBeInstanceOf(Date);
  });

  it('이미 탈퇴한 회원의 정보 접근을 거절한다', async () => {
    repository.findOne.mockResolvedValue({
      ...activeUser,
      withdrawnAt: new Date(),
    });

    await expect(service.getActiveProfile(1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
