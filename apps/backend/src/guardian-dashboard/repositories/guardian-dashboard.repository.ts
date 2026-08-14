/* 역할: 보호자-시니어 연결 정보와 홈 화면 최근 7일 리포트를 읽기 전용으로 조회한다. */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ConversationMessage,
  SpeakerType,
} from '../../chats/entities/conversation-message.entity';
import { DailyEmotionReport } from '../../reports/entities/daily-emotion-report.entity';
import {
  ConnectionStatus,
  GuardianSeniorRelationship,
} from '../../users/entities/guardian-senior-relationship.entity';
import { User } from '../../users/entities/user.entity';

export interface GuardianDashboardConnectionRow {
  guardianId: number;
  guardianName: string;
  seniorId: number;
  seniorName: string;
  connectedAt: Date;
}

@Injectable()
export class GuardianDashboardRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findConnectedPair(
    guardianId: number,
  ): Promise<GuardianDashboardConnectionRow | null> {
    const row = await this.dataSource
      .getRepository(GuardianSeniorRelationship)
      .createQueryBuilder('relationship')
      .innerJoin(
        User,
        'guardian',
        'guardian.USER_ID = relationship.GUARDIAN_ID',
      )
      .innerJoin(User, 'senior', 'senior.USER_ID = relationship.SENIOR_ID')
      .select('relationship.GUARDIAN_ID', 'guardianId')
      .addSelect('guardian.NAME', 'guardianName')
      .addSelect('relationship.SENIOR_ID', 'seniorId')
      .addSelect('senior.NAME', 'seniorName')
      .addSelect('relationship.APPROVED_AT', 'connectedAt')
      .where('relationship.GUARDIAN_ID = :guardianId', { guardianId })
      .andWhere('relationship.CONNECTION_STATUS = :status', {
        status: ConnectionStatus.CONNECTED,
      })
      .getRawOne<GuardianDashboardConnectionRow>();

    if (!row) return null;
    return {
      guardianId: Number(row.guardianId),
      guardianName: row.guardianName,
      seniorId: Number(row.seniorId),
      seniorName: row.seniorName,
      connectedAt: new Date(row.connectedAt),
    };
  }

  findDailyReports(
    seniorId: number,
    startDate: string,
    endDate: string,
  ): Promise<DailyEmotionReport[]> {
    return this.dataSource
      .getRepository(DailyEmotionReport)
      .createQueryBuilder('report')
      .where('report.SENIOR_ID = :seniorId', { seniorId })
      .andWhere('report.REPORT_DATE BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('report.REPORT_DATE', 'ASC')
      .getMany();
  }

  async hasSeniorConversation(
    seniorId: number,
    start: Date,
    end: Date,
  ): Promise<boolean> {
    const count = await this.dataSource
      .getRepository(ConversationMessage)
      .createQueryBuilder('message')
      .where('message.SENIOR_ID = :seniorId', { seniorId })
      .andWhere('message.SPEAKER_TYPE = :speakerType', {
        speakerType: SpeakerType.SENIOR,
      })
      .andWhere('message.CREATED_AT >= :start', { start })
      .andWhere('message.CREATED_AT < :end', { end })
      .getCount();
    return count > 0;
  }
}
