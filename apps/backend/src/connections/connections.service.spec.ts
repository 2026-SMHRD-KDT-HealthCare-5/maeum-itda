/* 역할: 연결 요청의 생성·수락·거절·취소·해제 상태 전이와 역할 권한을 검증한다. */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import {
  ConnectionStatus,
  GuardianSeniorRelationship,
} from '../users/entities/guardian-senior-relationship.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ConnectionsService } from './connections.service';

describe('ConnectionsService', () => {
  const relationshipsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const usersRepository = { findOne: jest.fn() };
  const service = new ConnectionsService(
    relationshipsRepository as unknown as Repository<GuardianSeniorRelationship>,
    usersRepository as unknown as Repository<User>,
  );

  const guardianAuth = { sub: 2, role: UserRole.GUARDIAN };
  const seniorAuth = { sub: 1, role: UserRole.SENIOR };
  const guardian = {
    userId: 2,
    loginId: 'guardian01',
    passwordHash: 'hash',
    name: '김민준',
    phone: '01011112222',
    role: UserRole.GUARDIAN,
    joinedAt: new Date('2026-08-13T00:00:00.000Z'),
    withdrawnAt: null,
  } as User;
  const senior = {
    ...guardian,
    userId: 1,
    loginId: 'senior01',
    name: '김순자',
    role: UserRole.SENIOR,
  } as User;

  function requestedRelationship(): GuardianSeniorRelationship {
    return {
      relationshipId: 10,
      guardianId: 2,
      seniorId: 1,
      connectionStatus: ConnectionStatus.REQUESTED,
      requestedAt: new Date('2026-08-13T01:00:00.000Z'),
      approvedAt: null,
      disconnectedAt: null,
      activeGuardianId: 2,
      activeSeniorId: 1,
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('보호자가 시니어에게 연결 요청을 생성한다', async () => {
    const relationship = requestedRelationship();
    usersRepository.findOne.mockResolvedValue(senior);
    relationshipsRepository.findOne.mockResolvedValue(null);
    relationshipsRepository.create.mockReturnValue(relationship);
    relationshipsRepository.save.mockResolvedValue(relationship);

    const result = await service.createRequest(guardianAuth, {
      seniorLoginId: 'senior01',
    });

    expect(result.status).toBe(ConnectionStatus.REQUESTED);
    expect(result.counterpart.userId).toBe(1);
  });

  it('시니어 역할로 연결 요청을 생성할 수 없다', async () => {
    await expect(
      service.createRequest(seniorAuth, { seniorLoginId: 'senior01' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('활성 관계가 있는 보호자의 중복 요청을 거절한다', async () => {
    usersRepository.findOne.mockResolvedValue(senior);
    relationshipsRepository.findOne.mockResolvedValue(requestedRelationship());

    await expect(
      service.createRequest(guardianAuth, { seniorLoginId: 'senior01' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('시니어가 요청을 수락하면 연결 시각을 기록한다', async () => {
    const relationship = requestedRelationship();
    relationshipsRepository.findOne.mockResolvedValue(relationship);
    relationshipsRepository.save.mockImplementation(
      (value: GuardianSeniorRelationship) => Promise.resolve(value),
    );
    usersRepository.findOne.mockResolvedValue(guardian);

    const result = await service.acceptRequest(seniorAuth, 10);

    expect(result.status).toBe(ConnectionStatus.CONNECTED);
    expect(result.connectedAt).toBeInstanceOf(Date);
  });

  it('시니어가 요청을 거절하면 REJECTED로 저장한다', async () => {
    const relationship = requestedRelationship();
    let saved: GuardianSeniorRelationship | undefined;
    relationshipsRepository.findOne.mockResolvedValue(relationship);
    relationshipsRepository.save.mockImplementation(
      (value: GuardianSeniorRelationship) => {
        saved = value;
        return Promise.resolve(value);
      },
    );

    await service.rejectRequest(seniorAuth, 10);

    expect(saved?.connectionStatus).toBe(ConnectionStatus.REJECTED);
  });

  it('보호자가 요청을 취소하면 대기 요청 행을 제거한다', async () => {
    const relationship = requestedRelationship();
    relationshipsRepository.findOne.mockResolvedValue(relationship);
    relationshipsRepository.remove.mockResolvedValue(relationship);

    await service.cancelRequest(guardianAuth, 10);

    expect(relationshipsRepository.remove).toHaveBeenCalledWith(relationship);
    expect(relationshipsRepository.save).not.toHaveBeenCalled();
  });

  it('연결을 끊으면 DISCONNECTED와 해제 시각을 저장한다', async () => {
    const relationship = {
      ...requestedRelationship(),
      connectionStatus: ConnectionStatus.CONNECTED,
      approvedAt: new Date('2026-08-13T02:00:00.000Z'),
    };
    let saved: GuardianSeniorRelationship | undefined;
    relationshipsRepository.findOne.mockResolvedValue(relationship);
    relationshipsRepository.save.mockImplementation(
      (value: GuardianSeniorRelationship) => {
        saved = value;
        return Promise.resolve(value);
      },
    );

    await service.disconnect(guardianAuth);

    expect(saved?.connectionStatus).toBe(ConnectionStatus.DISCONNECTED);
    expect(saved?.disconnectedAt).toBeInstanceOf(Date);
  });

  it('활성 연결이 없으면 빈 연결 응답을 반환한다', async () => {
    relationshipsRepository.findOne.mockResolvedValue(null);

    await expect(service.getMyConnection(seniorAuth)).resolves.toEqual({
      relationshipId: null,
      status: null,
      requestedAt: null,
      connectedAt: null,
      counterpart: null,
    });
  });
});
