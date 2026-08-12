import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum SpeakerType {
  AI = 'AI',
  SENIOR = 'SENIOR',
}

export enum SttStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  WAITING = 'WAITING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity({ name: 'CONVERSATION_MESSAGE' })
@Index('IX_MESSAGE_SENIOR_CREATED', ['seniorId', 'createdAt', 'messageId'])
@Check(
  'CK_MESSAGE_SPEAKER_STT',
  "SPEAKER_TYPE = 'SENIOR' OR STT_STATUS = 'NOT_REQUIRED'",
)
@Check(
  'CK_MESSAGE_CONTENT',
  "CONTENT IS NOT NULL OR (SPEAKER_TYPE = 'SENIOR' AND STT_STATUS IN ('WAITING', 'PROCESSING', 'FAILED'))",
)
@Check(
  'CK_MESSAGE_STT_ERROR',
  "(STT_STATUS = 'FAILED' AND STT_ERROR_MESSAGE IS NOT NULL) OR (STT_STATUS <> 'FAILED' AND STT_ERROR_MESSAGE IS NULL)",
)
export class ConversationMessage {
  @PrimaryGeneratedColumn({ name: 'MESSAGE_ID', type: 'int' })
  messageId: number;

  @Column({ name: 'SENIOR_ID', type: 'int' })
  seniorId: number;

  @Column({ name: 'SPEAKER_TYPE', type: 'enum', enum: SpeakerType })
  speakerType: SpeakerType;

  @Column({ name: 'CONTENT', type: 'text', nullable: true })
  content: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({
    name: 'STT_STATUS',
    type: 'enum',
    enum: SttStatus,
    default: SttStatus.NOT_REQUIRED,
  })
  sttStatus: SttStatus;

  @Column({ name: 'STT_ERROR_MESSAGE', type: 'text', nullable: true })
  sttErrorMessage: string | null;
}
