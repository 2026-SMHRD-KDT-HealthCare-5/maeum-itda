/* 역할: 일간·주간 조회 서비스가 공유하는 보호자-시니어 연결 접근 대상을 조회한다. */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ConnectionStatus,
  GuardianSeniorRelationship,
} from '../../users/entities/guardian-senior-relationship.entity';

@Injectable()
export class ReportAccessRepository {
  constructor(private readonly dataSource: DataSource) {}

  // seniorId를 요청값으로 받지 않고 현재 CONNECTED 관계에서 찾아 타인 리포트 접근을 막는다.
  async findConnectedSeniorId(guardianId: number): Promise<number | null> {
    const relationship = await this.dataSource
      .getRepository(GuardianSeniorRelationship)
      .findOne({
        where: {
          guardianId,
          connectionStatus: ConnectionStatus.CONNECTED,
        },
        select: { seniorId: true },
      });
    return relationship?.seniorId ?? null;
  }
}
