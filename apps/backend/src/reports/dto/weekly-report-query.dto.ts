/* 역할: 보호자 주간 리포트 조회의 월요일 시작일 형식을 검증한다. */
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class WeeklyReportQueryDto {
  @ApiProperty({
    description: '서울 기준 조회 주의 월요일(YYYY-MM-DD)',
    example: '2026-08-03',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'weekStart는 YYYY-MM-DD 형식이어야 합니다.',
  })
  @IsDateString(
    { strict: true },
    { message: 'weekStart는 유효한 날짜여야 합니다.' },
  )
  weekStart: string;
}
