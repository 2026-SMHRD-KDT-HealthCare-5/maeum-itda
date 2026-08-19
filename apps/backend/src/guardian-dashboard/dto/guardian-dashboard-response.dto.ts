/* 역할: 보호자 홈 한 번의 조회에 필요한 연결 정보, 전날 리포트, 최근 7일 추이를 정의한다. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenerationStatus } from '../../reports/entities/daily-emotion-report.entity';
import { EmotionLevel } from '../../reports/lib/weekly-report-statistics';

export class GuardianDashboardPersonDto {
  @ApiProperty({ example: 10 })
  userId: number;

  @ApiProperty({ example: '테스트가디언' })
  name: string;
}

export class GuardianDashboardSeniorDto extends GuardianDashboardPersonDto {
  @ApiProperty({ format: 'date-time' })
  connectedAt: Date;

  @ApiProperty({
    description: '연결 승인일을 1일째로 계산한 함께한 일수',
    example: 30,
  })
  daysTogether: number;
}

export class GuardianDashboardDailyReportDto {
  @ApiPropertyOptional({ nullable: true, example: 9 })
  reportId: number | null;

  @ApiProperty({ format: 'date', example: '2026-08-13' })
  reportDate: string;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    maximum: 100,
    example: 49,
  })
  emotionIndex: number | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: EmotionLevel,
    example: EmotionLevel.BAD,
  })
  emotionLevel: EmotionLevel | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '평소보다 정서지수가 낮게 나타났어요.',
  })
  conversationSummary: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '가볍게 안부를 확인해 주세요.',
  })
  recommendedAction: string | null;

  @ApiPropertyOptional({ nullable: true, enum: GenerationStatus })
  generationStatus: GenerationStatus | null;
}

export class GuardianDashboardTrendPointDto {
  @ApiProperty({ format: 'date', example: '2026-08-13' })
  date: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 49,
    minimum: 0,
    maximum: 100,
  })
  emotionIndex: number | null;
}

export class GuardianDashboardResponseDto {
  @ApiProperty({ type: GuardianDashboardPersonDto })
  guardian: GuardianDashboardPersonDto;

  @ApiProperty({ type: GuardianDashboardSeniorDto })
  senior: GuardianDashboardSeniorDto;

  @ApiProperty({
    description:
      '전날 리포트의 권장 행동. 대화 없음과 분석 데이터 부족은 각각 안내 문구로 구분',
    example: '가볍게 안부를 확인해 주세요.',
  })
  dasolMessage: string;

  @ApiProperty({ type: GuardianDashboardDailyReportDto })
  latestDailyReport: GuardianDashboardDailyReportDto;

  @ApiProperty({ type: [GuardianDashboardTrendPointDto] })
  recentSevenDays: GuardianDashboardTrendPointDto[];
}
