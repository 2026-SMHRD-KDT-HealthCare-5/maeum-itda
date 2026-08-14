/* 역할: 내 정보 조회·수정 응답을 Swagger 문서의 명시적인 스키마로 제공한다. */
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 'senior01' })
  loginId: string;

  @ApiProperty({ example: '김순자' })
  name: string;

  @ApiProperty({ example: '01012345678' })
  phone: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SENIOR })
  role: UserRole;

  @ApiProperty({ format: 'date-time', example: '2026-08-13T09:00:00.000Z' })
  joinedAt: Date;
}
