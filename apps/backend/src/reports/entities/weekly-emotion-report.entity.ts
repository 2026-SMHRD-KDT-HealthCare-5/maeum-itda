import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GenerationStatus } from './daily-emotion-report.entity';

@Entity({ name: 'WEEKLY_EMOTION_REPORT' })
@Index('UK_WEEKLY_REPORT_SENIOR_START', ['seniorId', 'startDate'], {
  unique: true,
})
export class WeeklyEmotionReport {
  @PrimaryGeneratedColumn({ name: 'WEEKLY_REPORT_ID', type: 'int' })
  weeklyReportId: number;

  @Column({ name: 'SENIOR_ID', type: 'int' })
  seniorId: number;

  @Column({ name: 'START_DATE', type: 'date' })
  startDate: string;

  @Column({ name: 'WEEKLY_SUMMARY', type: 'text' })
  weeklySummary: string;

  @Column({
    name: 'GENERATION_STATUS',
    type: 'enum',
    enum: GenerationStatus,
    default: GenerationStatus.WAITING,
  })
  generationStatus: GenerationStatus;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
