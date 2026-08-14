/* 역할: 보호자 일간 리포트 조회 날짜를 서울 기준 YYYY-MM-DD 형식으로 검증한다. */
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class DailyReportQueryDto {
  @ApiProperty({
    description: '조회할 서울 기준 리포트 날짜(YYYY-MM-DD)',
    example: '2026-08-14',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date는 YYYY-MM-DD 형식이어야 합니다.',
  })
  @IsDateString({ strict: true }, { message: 'date는 유효한 날짜여야 합니다.' })
  date: string;
}
