import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'DAILY_REPORT_EVIDENCE' })
@Index('IX_DAILY_EVIDENCE_MESSAGE', ['messageId'])
export class DailyReportEvidence {
  @PrimaryColumn({ name: 'REPORT_ID', type: 'int' })
  reportId: number;

  @PrimaryColumn({ name: 'MESSAGE_ID', type: 'int' })
  messageId: number;
}
