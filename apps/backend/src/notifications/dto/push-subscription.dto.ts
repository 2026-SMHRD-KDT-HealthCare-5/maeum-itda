/* 역할: 브라우저 PushSubscription 등록·해제 요청과 안전한 응답 Swagger 계약을 정의한다. */
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: '브라우저 PushSubscription의 p256dh 공개키' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(BASE64_URL_PATTERN)
  p256dh: string;

  @ApiProperty({ description: '브라우저 PushSubscription의 auth 인증값' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(BASE64_URL_PATTERN)
  auth: string;
}

export class UpsertPushSubscriptionDto {
  @ApiProperty({
    description: 'Push Service가 발급한 HTTPS endpoint',
    example: 'https://fcm.googleapis.com/fcm/send/example-token',
  })
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  endpoint: string;

  @ApiPropertyOptional({
    description: '브라우저가 제공한 만료 시각(ms). 보통 null',
    nullable: true,
    example: null,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  expirationTime?: number | null;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class DeletePushSubscriptionDto {
  @ApiProperty({
    description: '해제할 현재 브라우저 PushSubscription endpoint',
    example: 'https://fcm.googleapis.com/fcm/send/example-token',
  })
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  endpoint: string;
}

export class PushSubscriptionResponseDto {
  @ApiProperty({ example: 1 })
  subscriptionId: number;

  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/example-token' })
  endpoint: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  expirationTime: number | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class VapidPublicKeyResponseDto {
  @ApiProperty({
    description: '브라우저 pushManager.subscribe()에 전달할 공개키',
  })
  publicKey: string;
}
