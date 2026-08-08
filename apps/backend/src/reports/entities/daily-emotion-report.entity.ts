/*
역할: 시니어의 일간 감정 리포트와 DAILY_EMOTION_REPORT 테이블을 연결한다.
전체 흐름: ReportsService → Repository<DailyEmotionReport> → MySQL
*/
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum GenerationStatus {
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// SENIOR_ID와 날짜별로 하나의 일간 리포트가 저장되도록 매핑한다.
@Entity({ name: 'DAILY_EMOTION_REPORT' })
@Index('UK_REPORT_SENIOR_DATE', ['seniorId', 'reportDate'], { unique: true })
@Check(
  'CK_REPORT_EMOTION_INDEX',
  'EMOTION_INDEX IS NULL OR EMOTION_INDEX BETWEEN 0 AND 100',
)
@Check(
  'CK_REPORT_EVIDENCE',
  "EVIDENCE_MESSAGE_IDS IS NULL OR JSON_TYPE(EVIDENCE_MESSAGE_IDS) = 'ARRAY'",
)
export class DailyEmotionReport {
  @PrimaryGeneratedColumn({ name: 'REPORT_ID', type: 'int' }) reportId: number;
  @Column({ name: 'SENIOR_ID', type: 'int' }) seniorId: number;
  @Column({ name: 'REPORT_DATE', type: 'date' }) reportDate: string;
  @Column({ name: 'EMOTION_INDEX', type: 'int', nullable: true }) emotionIndex:
    number | null;
  @Column({
    name: 'ONE_LINE_SUMMARY',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  oneLineSummary: string | null;
  @Column({ name: 'RECOMMENDED_ACTION', type: 'text', nullable: true })
  recommendedAction: string | null;
  @Column({ name: 'EVIDENCE_MESSAGE_IDS', type: 'json', nullable: true })
  evidenceMessageIds: number[] | null;
  @Column({
    name: 'GENERATION_STATUS',
    type: 'enum',
    enum: GenerationStatus,
    default: GenerationStatus.WAITING,
  })
  generationStatus: GenerationStatus;
  @CreateDateColumn({ name: 'CREATED_AT', type: 'datetime' }) createdAt: Date;
}
