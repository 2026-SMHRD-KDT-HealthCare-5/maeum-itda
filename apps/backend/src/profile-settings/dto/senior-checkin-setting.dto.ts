/* 역할: 시니어 안부 알림 설정의 입력 검증과 Swagger 응답 계약을 정의한다. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class UpdateSeniorCheckinSettingDto {
  @ApiPropertyOptional({
    description: '매일 안부 알림 사용 여부',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Asia/Seoul 기준 매일 알림 시각',
    example: '19:00',
    pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: '알림 시간은 HH:mm 형식으로 입력해주세요.',
  })
  time?: string;
}

export class SeniorCheckinSettingResponseDto {
  @ApiProperty({ description: '매일 안부 알림 사용 여부', example: true })
  enabled!: boolean;

  @ApiProperty({
    description: 'Asia/Seoul 기준 매일 알림 시각',
    example: '19:00',
  })
  time!: string;
}
