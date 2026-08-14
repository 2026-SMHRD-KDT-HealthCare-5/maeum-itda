/* 역할: 저장된 일간 정서 리포트의 보호자 조회 REST·Swagger 응답 계약을 정의한다. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenerationStatus } from '../entities/daily-emotion-report.entity';

export enum DailyEvidenceSentimentLabel {
  POSITIVE = '긍정',
  NEUTRAL = '보통',
  NEGATIVE = '부정',
}

export enum DailyEvidenceScaleLabel {
  SGDS_K = '우울',
  GAD_7 = '불안',
  LSNS_6 = '고립',
}

export class DailyReportEvidenceResponseDto {
  @ApiProperty({ example: 101 })
  messageId: number;

  @ApiPropertyOptional({ nullable: true, example: '어젯밤에는 잘 주무셨어요?' })
  question: string | null;

  @ApiProperty({ example: '새벽에 한 번 깼지만 괜찮아.' })
  answer: string;

  @ApiProperty({ example: true })
  isRiskEvidence: boolean;

  @ApiPropertyOptional({
    nullable: true,
    enum: DailyEvidenceSentimentLabel,
    example: DailyEvidenceSentimentLabel.NEGATIVE,
  })
  sentimentLabel: DailyEvidenceSentimentLabel | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: DailyEvidenceScaleLabel,
    example: DailyEvidenceScaleLabel.GAD_7,
  })
  scaleLabel: DailyEvidenceScaleLabel | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  questionCreatedAt: Date | null;

  @ApiProperty({ format: 'date-time' })
  answerCreatedAt: Date;
}

export class DailyReportResponseDto {
  @ApiProperty({ example: 31 })
  reportId: number;

  @ApiProperty({ description: '연결된 시니어 ID', example: 7 })
  seniorId: number;

  @ApiProperty({ description: '서울 기준 리포트 날짜', example: '2026-08-14' })
  reportDate: string;

  @ApiPropertyOptional({
    description: '0~100 정서지수. 데이터가 부족하면 null',
    minimum: 0,
    maximum: 100,
    nullable: true,
    example: 80,
  })
  emotionIndex: number | null;

  @ApiPropertyOptional({
    description: '하루 대화 한 줄 요약. 생성 전이면 null',
    nullable: true,
    example: '오늘은 가족과 산책한 이야기를 편안하게 나누셨어요.',
  })
  oneLineSummary: string | null;

  @ApiPropertyOptional({
    description: '보호자에게 제안하는 행동. 생성 전이면 null',
    nullable: true,
    example: '가벼운 안부 전화를 건네 보세요.',
  })
  recommendedAction: string | null;

  @ApiProperty({ enum: GenerationStatus, example: GenerationStatus.COMPLETED })
  generationStatus: GenerationStatus;

  @ApiProperty({ type: [DailyReportEvidenceResponseDto] })
  evidences: DailyReportEvidenceResponseDto[];

  @ApiProperty({ example: '2026-08-15T00:00:00.000Z' })
  createdAt: Date;
}
