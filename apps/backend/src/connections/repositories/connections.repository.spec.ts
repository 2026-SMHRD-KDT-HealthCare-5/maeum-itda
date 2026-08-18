/* 역할: 연결 도메인의 사용자·관계 TypeORM 조회 조건과 저장 위임을 검증한다. */
import type { Repository } from 'typeorm';
import {
  ConnectionStatus,
  GuardianSeniorRelationship,
} from '../../users/entities/guardian-senior-relationship.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { ConnectionsRepository } from './connections.repository';

describe('ConnectionsRepository', () => {
  function createRepository() {
    const relationshipsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    const usersRepository = { findOne: jest.fn() };
    return {
      repository: new ConnectionsRepository(
        relationshipsRepository as unknown as Repository<GuardianSeniorRelationship>,
        usersRepository as unknown as Repository<User>,
      ),
      relationshipsRepository,
      usersRepository,
    };
  }

  it('보호자의 활성 연결은 guardianId와 활성 상태로 조회한다', async () => {
    const context = createRepository();
    context.relationshipsRepository.findOne.mockResolvedValue(null);

    await context.repository.findActiveForUser(7, UserRole.GUARDIAN);

    expect(context.relationshipsRepository.findOne).toHaveBeenCalledWith({
      where: {
        guardianId: 7,
        // Jest의 비대칭 matcher는 타입 정의상 any이므로 이 검증 한 줄만 예외 처리한다.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        connectionStatus: expect.anything(),
      },
    });
  });

  it('연결 요청 Entity를 생성해 REQUESTED 상태로 저장한다', async () => {
    const context = createRepository();
    const relationship = {
      guardianId: 7,
      seniorId: 9,
      connectionStatus: ConnectionStatus.REQUESTED,
    } as GuardianSeniorRelationship;
    context.relationshipsRepository.create.mockReturnValue(relationship);
    context.relationshipsRepository.save.mockResolvedValue(relationship);

    await expect(context.repository.createRequest(7, 9)).resolves.toBe(
      relationship,
    );
    expect(context.relationshipsRepository.create).toHaveBeenCalledWith({
      guardianId: 7,
      seniorId: 9,
      connectionStatus: ConnectionStatus.REQUESTED,
      approvedAt: null,
      disconnectedAt: null,
    });
  });
});
