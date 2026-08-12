import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AlertType {
  EMOTION_INDEX_DROP = 'EMOTION_INDEX_DROP',
  WEEKLY_REPORT_READY = 'WEEKLY_REPORT_READY',
}

@Entity({ name: 'GUARDIAN_NOTIFICATION' })
@Index('UK_NOTIFICATION_DAILY_REPORT', ['dailyReportId'], { unique: true })
@Index('UK_NOTIFICATION_WEEKLY_REPORT', ['weeklyReportId'], { unique: true })
@Index('IX_NOTIFICATION_GUARDIAN_LIST', [
  'guardianId',
  'isRead',
  'createdAt',
  'alertId',
])
@Check(
  'CK_NOTIFICATION_TARGET',
  "(ALERT_TYPE = 'EMOTION_INDEX_DROP' AND DAILY_REPORT_ID IS NOT NULL AND WEEKLY_REPORT_ID IS NULL) OR (ALERT_TYPE = 'WEEKLY_REPORT_READY' AND DAILY_REPORT_ID IS NULL AND WEEKLY_REPORT_ID IS NOT NULL)",
)
export class GuardianNotification {
  @PrimaryGeneratedColumn({ name: 'ALERT_ID', type: 'int' })
  alertId: number;

  @Column({ name: 'GUARDIAN_ID', type: 'int' })
  guardianId: number;

  @Column({ name: 'DAILY_REPORT_ID', type: 'int', nullable: true })
  dailyReportId: number | null;

  @Column({ name: 'WEEKLY_REPORT_ID', type: 'int', nullable: true })
  weeklyReportId: number | null;

  @Column({ name: 'ALERT_TYPE', type: 'enum', enum: AlertType })
  alertType: AlertType;

  @Column({ name: 'CONTENT', type: 'text' })
  content: string;

  @Column({ name: 'IS_READ', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'datetime', precision: 3 })
  createdAt: Date;
}
