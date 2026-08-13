/*
역할: 내 정보 화면에서 수정 가능한 이름과 휴대폰 번호만 검증한다.
전체 흐름: HTTP body → ValidationPipe → UpdateMyProfileDto → UsersController → UsersService
*/
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizePhoneNumber } from '../phone-number';

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ description: '사용자 이름', example: '김순자' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    description: '휴대폰 번호(하이픈 포함·미포함 허용)',
    example: '010-1234-5678',
  })
  @IsOptional()
  @Transform(({ value }) => normalizePhoneNumber(value))
  @IsString()
  @Matches(/^01[016789]\d{7,8}$/, {
    message: '올바른 휴대폰 번호를 입력해주세요.',
  })
  phone?: string;
}
