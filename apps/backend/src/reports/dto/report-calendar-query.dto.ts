/* 역할: 일간·주간 통합 달력 조회의 연도와 월 입력값을 검증한다. */
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportCalendarQueryDto {
  @ApiProperty({
    description: '조회할 연도',
    minimum: 2020,
    maximum: 2100,
    example: 2026,
  })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @ApiProperty({
    description: '조회할 월',
    minimum: 1,
    maximum: 12,
    example: 8,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}
