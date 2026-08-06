/*
역할: 메시지의 텍스트 감정 분석 결과와 EMOTION_TAG 테이블을 연결한다.
전체 흐름: AnalysisService → Repository<EmotionTag> → MySQL
*/
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EmotionType {
  DEPRESSION = 'DEPRESSION',
  ANGER = 'ANGER',
  ANXIETY = 'ANXIETY',
  SADNESS = 'SADNESS',
  JOY = 'JOY',
  NEUTRAL = 'NEUTRAL',
}

// 한 메시지의 감정 종류별 점수와 분석 시각을 저장하도록 매핑한다.
@Entity({ name: 'EMOTION_TAG' })
@Index('UK_MESSAGE_EMOTION', ['messageId', 'emotionType'], { unique: true })
@Check('CK_EMOTION_SCORE', 'EMOTION_SCORE BETWEEN 0 AND 1')
export class EmotionTag {
  @PrimaryGeneratedColumn({ name: 'EMOTION_TAG_ID', type: 'int' })
  emotionTagId: number;
  @Column({ name: 'MESSAGE_ID', type: 'int' }) messageId: number;
  @Column({ name: 'EMOTION_TYPE', type: 'enum', enum: EmotionType })
  emotionType: EmotionType;
  @Column({ name: 'EMOTION_SCORE', type: 'int' }) emotionScore: number;
  @CreateDateColumn({ name: 'ANALYZED_AT', type: 'datetime' }) analyzedAt: Date;
}
