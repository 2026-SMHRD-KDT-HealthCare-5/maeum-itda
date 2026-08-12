import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ScaleType {
  SGDS_K = 'SGDS_K',
  GAD_7 = 'GAD_7',
  LSNS_6 = 'LSNS_6',
}

@Entity({ name: 'SCALE_QUESTION_ANALYSIS' })
@Index(
  'UK_SCALE_MESSAGE_QUESTION',
  ['messageId', 'scaleType', 'questionNumber'],
  { unique: true },
)
@Check('CK_SCALE_ANALYSIS_SCORE', 'ANALYSIS_SCORE IN (0, 1)')
@Check(
  'CK_SCALE_QUESTION_NUMBER',
  "(SCALE_TYPE = 'SGDS_K' AND QUESTION_NUMBER BETWEEN 1 AND 15) OR (SCALE_TYPE = 'GAD_7' AND QUESTION_NUMBER BETWEEN 1 AND 7) OR (SCALE_TYPE = 'LSNS_6' AND QUESTION_NUMBER BETWEEN 1 AND 6)",
)
export class ScaleQuestionAnalysis {
  @PrimaryGeneratedColumn({ name: 'SCALE_ANALYSIS_ID', type: 'int' })
  scaleAnalysisId: number;

  @Column({ name: 'MESSAGE_ID', type: 'int' })
  messageId: number;

  @Column({ name: 'SCALE_TYPE', type: 'enum', enum: ScaleType })
  scaleType: ScaleType;

  @Column({ name: 'QUESTION_NUMBER', type: 'int' })
  questionNumber: number;

  @Column({ name: 'ANALYSIS_SCORE', type: 'int' })
  analysisScore: number;

  @CreateDateColumn({ name: 'ANALYZED_AT', type: 'datetime', precision: 3 })
  analyzedAt: Date;
}
