/* 역할: 저장된 일간 정서 리포트의 보호자 조회 REST·Swagger 응답 계약을 정의한다. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenerationStatus } from '../entities/daily-emotion-report.entity';

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

  @ApiProperty({ example: '2026-08-15T00:00:00.000Z' })
  createdAt: Date;
}
