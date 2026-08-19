/*
역할: 보호자-시니어 연결의 상태 전이와 사용자별 접근 권한을 처리한다.
전체 흐름: ConnectionsController → ConnectionsService → ConnectionsRepository → MySQL
*/
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { AccessTokenPayload } from '../auth/auth.service';
import {
  ConnectionStatus,
  GuardianSeniorRelationship,
} from '../users/entities/guardian-senior-relationship.entity';
import { User, UserRole } from '../users/entities/user.entity';
import type { CreateConnectionRequestDto } from './dto/create-connection-request.dto';
import { ConnectionsRepository } from './repositories/connections.repository';

@Injectable()
export class ConnectionsService {
  constructor(private readonly connectionsRepository: ConnectionsRepository) {}

  async getMyConnection(authenticatedUser: AccessTokenPayload) {
    const relationship = await this.findActiveForUser(authenticatedUser);
    if (!relationship) return this.emptyConnection();
    return this.toResponse(relationship, authenticatedUser);
  }

  async createRequest(
    authenticatedUser: AccessTokenPayload,
    dto: CreateConnectionRequestDto,
  ) {
    this.requireRole(authenticatedUser, UserRole.GUARDIAN);

    const senior = await this.connectionsRepository.findSeniorByLoginId(
      dto.seniorLoginId,
    );
    if (!senior) {
      throw new NotFoundException('해당 아이디의 시니어를 찾을 수 없습니다.');
    }
    if (await this.findActiveForUser(authenticatedUser)) {
      throw new ConflictException('이미 대기 중인 요청 또는 연결이 있습니다.');
    }
    const seniorActive = await this.connectionsRepository.findActiveForSenior(
      senior.userId,
    );
    if (seniorActive) {
      throw new ConflictException(
        '해당 시니어는 이미 요청 또는 연결 상태입니다.',
      );
    }

    try {
      const saved = await this.connectionsRepository.createRequest(
        authenticatedUser.sub,
        senior.userId,
      );
      return this.toResponse(saved, authenticatedUser, senior);
    } catch (error: unknown) {
      if (this.isDuplicateEntry(error)) {
        throw new ConflictException(
          '이미 대기 중인 요청 또는 연결이 있습니다.',
        );
      }
      throw error;
    }
  }

  async acceptRequest(
    authenticatedUser: AccessTokenPayload,
    relationshipId: number,
  ) {
    this.requireRole(authenticatedUser, UserRole.SENIOR);
    const relationship = await this.getOwnedRequestedRelationship(
      authenticatedUser,
      relationshipId,
      UserRole.SENIOR,
    );
    relationship.connectionStatus = ConnectionStatus.CONNECTED;
    relationship.approvedAt = new Date();
    const saved = await this.connectionsRepository.save(relationship);
    return this.toResponse(saved, authenticatedUser);
  }

  async rejectRequest(
    authenticatedUser: AccessTokenPayload,
    relationshipId: number,
  ): Promise<void> {
    this.requireRole(authenticatedUser, UserRole.SENIOR);
    const relationship = await this.getOwnedRequestedRelationship(
      authenticatedUser,
      relationshipId,
      UserRole.SENIOR,
    );
    relationship.connectionStatus = ConnectionStatus.REJECTED;
    await this.connectionsRepository.save(relationship);
  }

  async cancelRequest(
    authenticatedUser: AccessTokenPayload,
    relationshipId: number,
  ): Promise<void> {
    this.requireRole(authenticatedUser, UserRole.GUARDIAN);
    const relationship = await this.getOwnedRequestedRelationship(
      authenticatedUser,
      relationshipId,
      UserRole.GUARDIAN,
    );
    // 테이블 명세에는 요청 취소 상태가 없으므로 아직 수락되지 않은 요청 행만 제거한다.
    // 연결 완료·거절·해제 이력은 기존 상태값으로 계속 보존한다.
    await this.connectionsRepository.remove(relationship);
  }

  async disconnect(authenticatedUser: AccessTokenPayload): Promise<void> {
    const relationship = await this.connectionsRepository.findConnectedForUser(
      authenticatedUser.sub,
      authenticatedUser.role,
    );
    if (!relationship) {
      throw new NotFoundException('현재 연결된 사용자가 없습니다.');
    }
    relationship.connectionStatus = ConnectionStatus.DISCONNECTED;
    relationship.disconnectedAt = new Date();
    await this.connectionsRepository.save(relationship);
  }

  private findActiveForUser(authenticatedUser: AccessTokenPayload) {
    return this.connectionsRepository.findActiveForUser(
      authenticatedUser.sub,
      authenticatedUser.role,
    );
  }

  private async getOwnedRequestedRelationship(
    authenticatedUser: AccessTokenPayload,
    relationshipId: number,
    ownerRole: UserRole,
  ): Promise<GuardianSeniorRelationship> {
    const relationship =
      await this.connectionsRepository.findById(relationshipId);
    if (!relationship) {
      throw new NotFoundException('연결 요청을 찾을 수 없습니다.');
    }
    const ownerId =
      ownerRole === UserRole.GUARDIAN
        ? relationship.guardianId
        : relationship.seniorId;
    if (ownerId !== authenticatedUser.sub) {
      throw new ForbiddenException('해당 연결 요청을 처리할 권한이 없습니다.');
    }
    if (relationship.connectionStatus !== ConnectionStatus.REQUESTED) {
      throw new ConflictException('이미 처리된 연결 요청입니다.');
    }
    return relationship;
  }

  private async toResponse(
    relationship: GuardianSeniorRelationship,
    authenticatedUser: AccessTokenPayload,
    knownCounterpart?: User,
  ) {
    const counterpartId =
      authenticatedUser.role === UserRole.GUARDIAN
        ? relationship.seniorId
        : relationship.guardianId;
    const counterpart =
      knownCounterpart ??
      (await this.connectionsRepository.findUserById(counterpartId));
    if (!counterpart || counterpart.withdrawnAt !== null) {
      throw new NotFoundException('연결 상대방을 찾을 수 없습니다.');
    }
    return {
      relationshipId: relationship.relationshipId,
      status: relationship.connectionStatus,
      requestedAt: relationship.requestedAt,
      connectedAt: relationship.approvedAt,
      counterpart: {
        userId: counterpart.userId,
        loginId: counterpart.loginId,
        name: counterpart.name,
        role: counterpart.role,
      },
    };
  }

  private emptyConnection() {
    return {
      relationshipId: null,
      status: null,
      requestedAt: null,
      connectedAt: null,
      counterpart: null,
    };
  }

  private requireRole(
    authenticatedUser: AccessTokenPayload,
    requiredRole: UserRole,
  ): void {
    if (authenticatedUser.role !== requiredRole) {
      throw new ForbiddenException('해당 역할로 수행할 수 없는 요청입니다.');
    }
  }

  private isDuplicateEntry(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    return (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY';
  }
}
