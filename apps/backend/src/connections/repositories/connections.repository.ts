/*
[완료] 역할: 보호자-시니어 연결에 필요한 관계·사용자 조회와 상태 저장을 캡슐화한다.
전체 흐름: ConnectionsService → ConnectionsRepository → TypeORM Repository → MySQL
*/
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  ConnectionStatus,
  GuardianSeniorRelationship,
} from '../../users/entities/guardian-senior-relationship.entity';
import { User, UserRole } from '../../users/entities/user.entity';

const ACTIVE_STATUSES = [
  ConnectionStatus.REQUESTED,
  ConnectionStatus.CONNECTED,
];

@Injectable()
export class ConnectionsRepository {
  constructor(
    @InjectRepository(GuardianSeniorRelationship)
    private readonly relationshipsRepository: Repository<GuardianSeniorRelationship>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findSeniorByLoginId(loginId: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { loginId, role: UserRole.SENIOR, withdrawnAt: IsNull() },
    });
  }

  findUserById(userId: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { userId } });
  }

  findActiveForUser(
    userId: number,
    role: UserRole,
  ): Promise<GuardianSeniorRelationship | null> {
    return this.relationshipsRepository.findOne({
      where: {
        ...(role === UserRole.GUARDIAN
          ? { guardianId: userId }
          : { seniorId: userId }),
        connectionStatus: In(ACTIVE_STATUSES),
      },
    });
  }

  findActiveForSenior(
    seniorId: number,
  ): Promise<GuardianSeniorRelationship | null> {
    return this.relationshipsRepository.findOne({
      where: { seniorId, connectionStatus: In(ACTIVE_STATUSES) },
    });
  }

  findConnectedForUser(
    userId: number,
    role: UserRole,
  ): Promise<GuardianSeniorRelationship | null> {
    return this.relationshipsRepository.findOne({
      where: {
        ...(role === UserRole.GUARDIAN
          ? { guardianId: userId }
          : { seniorId: userId }),
        connectionStatus: ConnectionStatus.CONNECTED,
      },
    });
  }

  findById(relationshipId: number): Promise<GuardianSeniorRelationship | null> {
    return this.relationshipsRepository.findOne({ where: { relationshipId } });
  }

  createRequest(
    guardianId: number,
    seniorId: number,
  ): Promise<GuardianSeniorRelationship> {
    const relationship = this.relationshipsRepository.create({
      guardianId,
      seniorId,
      connectionStatus: ConnectionStatus.REQUESTED,
      approvedAt: null,
      disconnectedAt: null,
    });
    return this.relationshipsRepository.save(relationship);
  }

  save(
    relationship: GuardianSeniorRelationship,
  ): Promise<GuardianSeniorRelationship> {
    return this.relationshipsRepository.save(relationship);
  }

  async remove(relationship: GuardianSeniorRelationship): Promise<void> {
    await this.relationshipsRepository.remove(relationship);
  }
}
