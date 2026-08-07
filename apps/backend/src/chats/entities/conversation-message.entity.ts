/*
역할: AI·시니어 대화 메시지 객체와 CONVERSATION_MESSAGE 테이블을 연결한다.
전체 흐름: ConversationMessageRepository → Repository<ConversationMessage> → MySQL
*/
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum SpeakerType {
  AI = 'AI',
  SENIOR = 'SENIOR',
  SYSTEM = 'SYSTEM',
}
export enum MessageType {
  MESSAGE = 'MESSAGE',
  CONVERSATION_END = 'CONVERSATION_END',
}
export enum SttStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  WAITING = 'WAITING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// 대화 세션 ID 없이 SENIOR_ID와 MESSAGE_ID를 기준으로 메시지를 저장한다.
@Entity({ name: 'CONVERSATION_MESSAGE' })
@Check(
  'CK_MESSAGE_CONTENT',
  "MESSAGE_TYPE = 'CONVERSATION_END' OR CONTENT IS NOT NULL",
)
@Check(
  'CK_MESSAGE_END_SPEAKER',
  "MESSAGE_TYPE <> 'CONVERSATION_END' OR SPEAKER_TYPE = 'SYSTEM'",
)
@Check(
  'CK_MESSAGE_STT_ERROR',
  "STT_STATUS = 'FAILED' OR STT_ERROR_MESSAGE IS NULL",
)
export class ConversationMessage {
  @PrimaryGeneratedColumn({ name: 'MESSAGE_ID', type: 'int' })
  messageId: number;
  @Column({ name: 'SENIOR_ID', type: 'int' }) seniorId: number;
  @Column({ name: 'REPORT_ID', type: 'int', nullable: true }) reportId:
    number | null;
  @Column({ name: 'SPEAKER_TYPE', type: 'enum', enum: SpeakerType })
  speakerType: SpeakerType;
  @Column({
    name: 'MESSAGE_TYPE',
    type: 'enum',
    enum: MessageType,
    default: MessageType.MESSAGE,
  })
  messageType: MessageType;
  @Column({ name: 'CONTENT', type: 'text', nullable: true }) content:
    string | null;
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
