import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum SentimentLabel {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}

@Entity({ name: 'EMOTION_TAG' })
@Index('UK_EMOTION_TAG_MESSAGE', ['messageId'], { unique: true })
export class EmotionTag {
  @PrimaryGeneratedColumn({ name: 'EMOTION_TAG_ID', type: 'int' })
  emotionTagId: number;

  @Column({ name: 'MESSAGE_ID', type: 'int' })
  messageId: number;

  @Column({ name: 'SENTIMENT_LABEL', type: 'enum', enum: SentimentLabel })
  sentimentLabel: SentimentLabel;

  @CreateDateColumn({ name: 'ANALYZED_AT', type: 'datetime', precision: 3 })
  analyzedAt: Date;
}
