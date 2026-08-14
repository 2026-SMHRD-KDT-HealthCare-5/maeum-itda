/* 역할: 전체 과거 대화 또는 특정 날짜 대화의 cursor 조회 입력값을 검증한다. */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ChatHistoryQueryDto {
  @ApiPropertyOptional({
    description: '서울 기준 조회 날짜. 생략하면 전체 과거 대화를 조회한다.',
    type: String,
    example: '2026-08-13',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date는 YYYY-MM-DD 형식이어야 합니다.',
  })
  @IsDateString({ strict: true }, { message: 'date는 유효한 날짜여야 합니다.' })
  date?: string;

  @ApiPropertyOptional({
    description: '이 메시지 ID보다 오래된 기록을 조회한다.',
    type: Number,
    minimum: 1,
    example: 101,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({
    description: '조회 개수',
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 30,
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
