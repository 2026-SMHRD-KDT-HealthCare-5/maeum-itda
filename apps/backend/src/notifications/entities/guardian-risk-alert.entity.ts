/*
역할: 보호자 위험 알림과 GUARDIAN_RISK_ALERT 테이블을 연결한다.
전체 흐름: NotificationsService → Repository<GuardianRiskAlert> → MySQL
*/
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AlertType {
  EMOTION_INDEX = 'EMOTION_INDEX',
  DEPRESSION = 'DEPRESSION',
  ANGER = 'ANGER',
  ANXIETY = 'ANXIETY',
  SELF_HARM = 'SELF_HARM',
  INACTIVITY = 'INACTIVITY',
}
export enum RiskLevel {
  CAUTION = 'CAUTION',
  WARNING = 'WARNING',
  EMERGENCY = 'EMERGENCY',
}
export enum DeliveryStatus {
  WAITING = 'WAITING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

// 알림의 위험도·전송 상태·확인 상태와 DB 제약조건을 매핑한다.
@Entity({ name: 'GUARDIAN_RISK_ALERT' })
@Check('CK_ALERT_SOURCE', 'REPORT_ID IS NOT NULL OR MESSAGE_ID IS NOT NULL')
@Check('CK_ALERT_SENT', "DELIVERY_STATUS <> 'SENT' OR SENT_AT IS NOT NULL")
@Check('CK_ALERT_CONFIRMED', 'IS_CONFIRMED = FALSE OR CONFIRMED_AT IS NOT NULL')
export class GuardianRiskAlert {
  @PrimaryGeneratedColumn({ name: 'ALERT_ID', type: 'int' }) alertId: number;
  @Column({ name: 'RELATIONSHIP_ID', type: 'int' }) relationshipId: number;
  @Column({ name: 'REPORT_ID', type: 'int', nullable: true }) reportId:
    number | null;
  @Column({ name: 'MESSAGE_ID', type: 'int', nullable: true }) messageId:
    number | null;
  @Column({ name: 'ALERT_TYPE', type: 'enum', enum: AlertType })
  alertType: AlertType;
  @Column({ name: 'RISK_LEVEL', type: 'enum', enum: RiskLevel })
  riskLevel: RiskLevel;
  @Column({ name: 'ALERT_CONTENT', type: 'text' }) alertContent: string;
  @Column({
    name: 'DELIVERY_STATUS',
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.WAITING,
  })
  deliveryStatus: DeliveryStatus;
  @Column({ name: 'IS_CONFIRMED', type: 'boolean', default: false })
  isConfirmed: boolean;
  @CreateDateColumn({ name: 'CREATED_AT', type: 'datetime' }) createdAt: Date;
  @Column({ name: 'SENT_AT', type: 'datetime', nullable: true })
  sentAt: Date | null;
  @Column({ name: 'CONFIRMED_AT', type: 'datetime', nullable: true })
  confirmedAt: Date | null;
}
