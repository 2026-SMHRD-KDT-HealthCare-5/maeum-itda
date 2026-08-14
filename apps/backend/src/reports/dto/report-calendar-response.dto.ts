/* 역할: 보호자 리포트 달력에 표시할 일간 날짜와 주간 범위를 한 응답으로 정의한다. */
import { ApiProperty } from '@nestjs/swagger';
import { GenerationStatus } from '../entities/daily-emotion-report.entity';

export class DailyReportCalendarItemDto {
  @ApiProperty({ example: 31 })
  reportId: number;

  @ApiProperty({ example: '2026-08-13' })
  date: string;

  @ApiProperty({ enum: GenerationStatus })
  generationStatus: GenerationStatus;
}

export class WeeklyReportCalendarItemDto {
  @ApiProperty({ example: 10 })
  weeklyReportId: number;

  @ApiProperty({ example: '2026-08-03' })
  weekStart: string;

  @ApiProperty({ example: '2026-08-09' })
  weekEnd: string;

  @ApiProperty({ enum: GenerationStatus })
  generationStatus: GenerationStatus;
}

export class ReportCalendarResponseDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 8 })
  month: number;

  @ApiProperty({ type: [DailyReportCalendarItemDto] })
  dailyReports: DailyReportCalendarItemDto[];

  @ApiProperty({ type: [WeeklyReportCalendarItemDto] })
  weeklyReports: WeeklyReportCalendarItemDto[];
}
