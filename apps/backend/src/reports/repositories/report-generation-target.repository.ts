/* 역할: 정기 리포트를 생성할 CONNECTED 보호자-시니어 쌍을 조회한다. */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ConnectionStatus,
  GuardianSeniorRelationship,
} from '../../users/entities/guardian-senior-relationship.entity';

export interface ReportGenerationTarget {
  guardianId: number;
  seniorId: number;
}

@Injectable()
export class ReportGenerationTargetRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findConnectedTargets(): Promise<ReportGenerationTarget[]> {
    const relationships = await this.dataSource
      .getRepository(GuardianSeniorRelationship)
      .find({
        where: { connectionStatus: ConnectionStatus.CONNECTED },
        select: { guardianId: true, seniorId: true },
      });
    return relationships.map(({ guardianId, seniorId }) => ({
      guardianId,
      seniorId,
    }));
  }

  async findConnectedGuardianId(seniorId: number): Promise<number | null> {
    const relationship = await this.dataSource
      .getRepository(GuardianSeniorRelationship)
      .findOne({
        where: { seniorId, connectionStatus: ConnectionStatus.CONNECTED },
        select: { guardianId: true },
      });
    return relationship?.guardianId ?? null;
  }
}
