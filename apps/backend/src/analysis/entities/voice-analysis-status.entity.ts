import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ProcessingStatus {
  WAITING = 'WAITING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// 역할: 메시지 한 건의 음성 분석 진행 상태와 실패 정보를 MySQL에 영구 저장한다.
// 연결 흐름: AnalysisResultRepository → VoiceAnalysisStatus Entity → VOICE_ANALYSIS_STATUS
@Entity({ name: 'VOICE_ANALYSIS_STATUS' })
@Index('UK_VOICE_ANALYSIS_MESSAGE', ['messageId'], { unique: true })
@Check(
  'CK_VOICE_ANALYSIS_RESULT',
  "(PROCESSING_STATUS IN ('WAITING', 'PROCESSING') AND ANALYZED_AT IS NULL AND ERROR_MESSAGE IS NULL) OR (PROCESSING_STATUS = 'COMPLETED' AND ANALYZED_AT IS NOT NULL AND ERROR_MESSAGE IS NULL) OR (PROCESSING_STATUS = 'FAILED' AND ERROR_MESSAGE IS NOT NULL)",
)
export class VoiceAnalysisStatus {
  // 음성 분석 상태 행의 자동 증가 기본키
  @PrimaryGeneratedColumn({ name: 'VOICE_ANALYSIS_ID', type: 'int' })
  voiceAnalysisId: number;

  // 분석 대상 CONVERSATION_MESSAGE의 ID이며 메시지당 한 행만 허용한다.
  @Column({ name: 'MESSAGE_ID', type: 'int' })
  messageId: number;

  // WAITING → PROCESSING → COMPLETED 또는 FAILED 처리 단계를 기록한다.
  @Column({
    name: 'PROCESSING_STATUS',
    type: 'enum',
    enum: ProcessingStatus,
    default: ProcessingStatus.WAITING,
  })
  processingStatus: ProcessingStatus;

  // 정상 분석이 완료된 UTC 시각이며 완료 전에는 NULL이다.
  @Column({
    name: 'ANALYZED_AT',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  analyzedAt: Date | null;

  // FAILED 상태의 오류 원인이며 정상 처리 상태에서는 NULL이다.
  @Column({ name: 'ERROR_MESSAGE', type: 'text', nullable: true })
  errorMessage: string | null;
}
