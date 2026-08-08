/*
역할: 보호자·시니어 연결 관계 객체와 GUARDIAN_SENIOR_RELATIONSHIP 테이블을 연결한다.
전체 흐름: 관계 Service → Repository<GuardianSeniorRelationship> → MySQL
*/
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ConnectionStatus {
  REQUESTED = 'REQUESTED',
  CONNECTED = 'CONNECTED',
  REJECTED = 'REJECTED',
  DISCONNECTED = 'DISCONNECTED',
}

// Entity는 테이블·컬럼을, Index와 Check는 DB 중복·유효성 제약조건을 정의한다.
@Entity({ name: 'GUARDIAN_SENIOR_RELATIONSHIP' })
@Index('UK_GSR_PAIR', ['guardianId', 'seniorId'], { unique: true })
@Check('CK_GSR_DIFFERENT_USERS', 'GUARDIAN_ID <> SENIOR_ID')
@Check(
  'CK_GSR_APPROVED_AT',
  'APPROVED_AT IS NULL OR APPROVED_AT >= REQUESTED_AT',
)
@Check(
  'CK_GSR_DISCONNECTED_AT',
  'DISCONNECTED_AT IS NULL OR DISCONNECTED_AT >= REQUESTED_AT',
)
export class GuardianSeniorRelationship {
  @PrimaryGeneratedColumn({ name: 'RELATIONSHIP_ID', type: 'int' })
  relationshipId: number;
  @Column({ name: 'GUARDIAN_ID', type: 'int' }) guardianId: number;
  @Column({ name: 'SENIOR_ID', type: 'int' }) seniorId: number;
  @Column({
    name: 'CONNECTION_STATUS',
    type: 'enum',
    enum: ConnectionStatus,
    default: ConnectionStatus.REQUESTED,
  })
  connectionStatus: ConnectionStatus;
  @CreateDateColumn({ name: 'REQUESTED_AT', type: 'datetime' })
  requestedAt: Date;
  @Column({ name: 'APPROVED_AT', type: 'datetime', nullable: true })
  approvedAt: Date | null;
  @Column({ name: 'DISCONNECTED_AT', type: 'datetime', nullable: true })
  disconnectedAt: Date | null;
}
