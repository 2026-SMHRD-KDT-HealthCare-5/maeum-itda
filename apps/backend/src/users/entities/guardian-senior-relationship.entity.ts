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

@Entity({ name: 'GUARDIAN_SENIOR_RELATIONSHIP' })
@Index('UK_RELATIONSHIP_ACTIVE_GUARDIAN', ['activeGuardianId'], {
  unique: true,
})
@Index('UK_RELATIONSHIP_ACTIVE_SENIOR', ['activeSeniorId'], { unique: true })
@Index('IX_RELATIONSHIP_GUARDIAN_HISTORY', [
  'guardianId',
  'requestedAt',
  'relationshipId',
])
@Index('IX_RELATIONSHIP_SENIOR_HISTORY', [
  'seniorId',
  'requestedAt',
  'relationshipId',
])
@Check('CK_RELATIONSHIP_DIFFERENT_USERS', 'GUARDIAN_ID <> SENIOR_ID')
@Check(
  'CK_RELATIONSHIP_STATUS_TIME',
  "(CONNECTION_STATUS IN ('REQUESTED', 'REJECTED') AND APPROVED_AT IS NULL AND DISCONNECTED_AT IS NULL) OR (CONNECTION_STATUS = 'CONNECTED' AND APPROVED_AT IS NOT NULL AND DISCONNECTED_AT IS NULL) OR (CONNECTION_STATUS = 'DISCONNECTED' AND APPROVED_AT IS NOT NULL AND DISCONNECTED_AT IS NOT NULL)",
)
@Check(
  'CK_RELATIONSHIP_TIME_ORDER',
  '(APPROVED_AT IS NULL OR REQUESTED_AT <= APPROVED_AT) AND (DISCONNECTED_AT IS NULL OR APPROVED_AT <= DISCONNECTED_AT)',
)
export class GuardianSeniorRelationship {
  @PrimaryGeneratedColumn({ name: 'RELATIONSHIP_ID', type: 'int' })
  relationshipId: number;

  @Column({ name: 'GUARDIAN_ID', type: 'int' })
  guardianId: number;

  @Column({ name: 'SENIOR_ID', type: 'int' })
  seniorId: number;

  @Column({
    name: 'CONNECTION_STATUS',
    type: 'enum',
    enum: ConnectionStatus,
    default: ConnectionStatus.REQUESTED,
  })
  connectionStatus: ConnectionStatus;

  @CreateDateColumn({ name: 'REQUESTED_AT', type: 'datetime', precision: 3 })
  requestedAt: Date;

  @Column({
    name: 'APPROVED_AT',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  approvedAt: Date | null;

  @Column({
    name: 'DISCONNECTED_AT',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  disconnectedAt: Date | null;

  @Column({
    name: 'ACTIVE_GUARDIAN_ID',
    type: 'int',
    nullable: true,
    insert: false,
    update: false,
  })
  activeGuardianId: number | null;

  @Column({
    name: 'ACTIVE_SENIOR_ID',
    type: 'int',
    nullable: true,
    insert: false,
    update: false,
  })
  activeSeniorId: number | null;
}
