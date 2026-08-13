/* 역할: 보호자 정서지수 하락 알림 설정의 입력 검증과 Swagger 응답 계약을 정의한다. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateGuardianAlertSettingDto {
  @ApiPropertyOptional({
    description: '정서지수 하락 알림 사용 여부',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: '정서지수 하락 알림 임계치',
    minimum: 0,
    maximum: 100,
    example: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  threshold?: number;
}

export class GuardianAlertSettingResponseDto {
  @ApiProperty({ description: '정서지수 하락 알림 사용 여부', example: true })
  enabled!: boolean;

  @ApiProperty({
    description: '정서지수 하락 알림 임계치',
    minimum: 0,
    maximum: 100,
    example: 50,
  })
  threshold!: number;
}
