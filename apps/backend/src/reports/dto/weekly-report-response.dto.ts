/* 역할: 주간 화면의 그래프·통계·일별 카드에 필요한 REST·Swagger 응답 계약을 정의한다. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenerationStatus } from '../entities/daily-emotion-report.entity';
import { EmotionLevel } from '../lib/weekly-report-statistics';

export class WeeklyDailyReportItemDto {
  @ApiPropertyOptional({ nullable: true, example: 31 })
  reportId: number | null;

  @ApiProperty({ example: '2026-08-03' })
  date: string;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    maximum: 100,
    example: 75,
  })
  emotionIndex: number | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: EmotionLevel,
    example: EmotionLevel.GOOD,
  })
  emotionLevel: EmotionLevel | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '대화를 편안하게 이어가셨어요.',
  })
  summary: string | null;
}

export class WeeklyReportResponseDto {
  @ApiProperty({ example: 10 })
  weeklyReportId: number;

  @ApiProperty({ example: 9 })
  seniorId: number;

  @ApiProperty({ example: '2026-08-03' })
  weekStart: string;

  @ApiProperty({ example: '2026-08-09' })
  weekEnd: string;

  @ApiProperty({ type: [WeeklyDailyReportItemDto] })
  dailyReports: WeeklyDailyReportItemDto[];

  @ApiProperty({ example: 5 })
  validDays: number;

  @ApiPropertyOptional({ nullable: true, example: 65 })
  averageScore: number | null;

  @ApiPropertyOptional({ nullable: true, example: 93 })
  maxScore: number | null;

  @ApiPropertyOptional({ nullable: true, example: 41 })
  minScore: number | null;

  @ApiProperty({
    example: '이번 주에는 전반적으로 안정적인 모습을 보이셨어요.',
  })
  weeklySummary: string;

  @ApiProperty({ enum: GenerationStatus, example: GenerationStatus.COMPLETED })
  generationStatus: GenerationStatus;

  @ApiProperty({ example: '2026-08-10T00:10:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-10T00:10:00.000Z' })
  updatedAt: Date;
}
