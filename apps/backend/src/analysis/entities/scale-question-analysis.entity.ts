/*
역할: 척도 문항 분석 결과와 SCALE_QUESTION_ANALYSIS 테이블을 연결한다.
전체 흐름: AnalysisService → Repository<ScaleQuestionAnalysis> → MySQL
*/
import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ScaleType {
  SGDS_K = 'SGDS_K',
  GAD_7 = 'GAD_7',
  LSNS_6 = 'LSNS_6',
}

// 메시지·척도·문항별 분석 결과가 중복되지 않도록 테이블과 제약조건을 매핑한다.
@Entity({ name: 'SCALE_QUESTION_ANALYSIS' })
@Index(
  'UK_SCALE_MESSAGE_QUESTION',
  ['messageId', 'scaleType', 'questionNumber'],
  { unique: true },
)
@Check(
  'CK_SCALE_SCORE',
  'ANALYSIS_SCORE IS NULL OR ANALYSIS_SCORE BETWEEN 0 AND 1',
)
@Check(
  'CK_SCALE_QUESTION_NUMBER',
  "(SCALE_TYPE='SGDS_K' AND QUESTION_NUMBER BETWEEN 1 AND 15) OR (SCALE_TYPE='GAD_7' AND QUESTION_NUMBER BETWEEN 1 AND 7) OR (SCALE_TYPE='LSNS_6' AND QUESTION_NUMBER BETWEEN 1 AND 6)",
)
export class ScaleQuestionAnalysis {
  @PrimaryGeneratedColumn({ name: 'SCALE_ANALYSIS_ID', type: 'int' })
  scaleAnalysisId: number;
  @Column({ name: 'MESSAGE_ID', type: 'int' }) messageId: number;
  @Column({ name: 'SCALE_TYPE', type: 'enum', enum: ScaleType })
  scaleType: ScaleType;
  @Column({ name: 'QUESTION_NUMBER', type: 'int' }) questionNumber: number;
  @Column({ name: 'IS_MATCHED', type: 'boolean', nullable: true }) isMatched:
    boolean | null;
  @Column({ name: 'ANALYSIS_SCORE', type: 'int', nullable: true })
  analysisScore: number | null;
  @Column({ name: 'ANALYZED_AT', type: 'datetime', nullable: true })
  analyzedAt: Date | null;
}
