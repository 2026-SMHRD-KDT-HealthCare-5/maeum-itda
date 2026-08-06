/*
역할: 음성 감정 분석 상태·결과와 VOICE_EMOTION_ANALYSIS 테이블을 연결한다.
전체 흐름: AnalysisService → Repository<VoiceEmotionAnalysis> → MySQL
주의: 요구사항은 수치형 음성 점수를 사용하지 않지만 테이블명세서에는 VOICE_EMOTION_SCORE가 남아 있어 팀 결정 전까지 명세 구조를 유지한다.
*/
import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { EmotionType } from './emotion-tag.entity';

export enum ProcessingStatus {
  WAITING = 'WAITING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// MESSAGE_ID별 음성 분석 처리 상태와 결과를 하나씩 저장하도록 매핑한다.
@Entity({ name: 'VOICE_EMOTION_ANALYSIS' })
@Index('UK_VOICE_MESSAGE', ['messageId'], { unique: true })
@Check(
  'CK_VOICE_SCORE',
  'VOICE_EMOTION_SCORE IS NULL OR VOICE_EMOTION_SCORE BETWEEN 0 AND 1',
)
@Check(
  'CK_VOICE_COMPLETED',
  "PROCESSING_STATUS <> 'COMPLETED' OR (VOICE_EMOTION_TYPE IS NOT NULL AND VOICE_EMOTION_SCORE IS NOT NULL AND ANALYZED_AT IS NOT NULL)",
)
@Check(
  'CK_VOICE_ERROR',
  "PROCESSING_STATUS = 'FAILED' OR ERROR_MESSAGE IS NULL",
)
export class VoiceEmotionAnalysis {
  @PrimaryGeneratedColumn({ name: 'VOICE_ANALYSIS_ID', type: 'int' })
  voiceAnalysisId: number;
  @Column({ name: 'MESSAGE_ID', type: 'int' }) messageId: number;
  @Column({
    name: 'VOICE_EMOTION_TYPE',
    type: 'enum',
    enum: EmotionType,
    nullable: true,
  })
  voiceEmotionType: EmotionType | null;
  @Column({ name: 'VOICE_EMOTION_SCORE', type: 'int', nullable: true })
  voiceEmotionScore: number | null;
  @Column({
    name: 'PROCESSING_STATUS',
    type: 'enum',
    enum: ProcessingStatus,
    default: ProcessingStatus.WAITING,
  })
  processingStatus: ProcessingStatus;
  @Column({ name: 'ANALYZED_AT', type: 'datetime', nullable: true })
  analyzedAt: Date | null;
  @Column({ name: 'ERROR_MESSAGE', type: 'text', nullable: true })
  errorMessage: string | null;
}
