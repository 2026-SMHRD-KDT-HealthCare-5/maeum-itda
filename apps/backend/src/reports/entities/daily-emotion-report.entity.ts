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

@Entity({ name: 'DAILY_EMOTION_REPORT' })
@Index('UK_DAILY_REPORT_SENIOR_DATE', ['seniorId', 'reportDate'], {
  unique: true,
})
@Index('IX_DAILY_REPORT_WEEKLY', ['weeklyReportId'])
@Check(
  'CK_DAILY_REPORT_EMOTION_INDEX',
  'EMOTION_INDEX IS NULL OR EMOTION_INDEX BETWEEN 0 AND 100',
)
export class DailyEmotionReport {
  @PrimaryGeneratedColumn({ name: 'REPORT_ID', type: 'int' })
  reportId: number;

  @Column({ name: 'WEEKLY_REPORT_ID', type: 'int', nullable: true })
  weeklyReportId: number | null;

  @Column({ name: 'SENIOR_ID', type: 'int' })
  seniorId: number;

  @Column({ name: 'REPORT_DATE', type: 'date' })
  reportDate: string;

  @Column({ name: 'EMOTION_INDEX', type: 'int', nullable: true })
  emotionIndex: number | null;

  @Column({
    name: 'ONE_LINE_SUMMARY',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  oneLineSummary: string | null;

  @Column({ name: 'RECOMMENDED_ACTION', type: 'text', nullable: true })
  recommendedAction: string | null;

  @Column({
    name: 'GENERATION_STATUS',
    type: 'enum',
    enum: GenerationStatus,
    default: GenerationStatus.WAITING,
  })
  generationStatus: GenerationStatus;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'datetime', precision: 3 })
  createdAt: Date;
}
