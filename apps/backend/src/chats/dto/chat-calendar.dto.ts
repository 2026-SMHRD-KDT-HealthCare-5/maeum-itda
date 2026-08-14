/* 역할: 시니어 이전 대화 달력의 요청값과 대화 존재 날짜 응답을 정의한다. */
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ChatCalendarQueryDto {
  @ApiProperty({ type: Number, minimum: 2020, maximum: 2100, example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @ApiProperty({ type: Number, minimum: 1, maximum: 12, example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

export class ChatCalendarResponseDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 8 })
  month: number;

  @ApiProperty({
    type: [String],
    example: ['2026-08-03', '2026-08-05', '2026-08-13'],
  })
  conversationDates: string[];
}
