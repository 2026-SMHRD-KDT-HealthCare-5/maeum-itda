/*
역할: 회원가입 요청 body의 데이터 형식과 검증 규칙을 정의한다.
전체 흐름: HTTP body → ValidationPipe → SignUpDto → AuthController → AuthService
*/
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';
import { normalizePhoneNumber } from '../../users/phone-number';

export class SignUpDto {
  // ApiProperty는 Swagger 문서를 만들고 class-validator 데코레이터는 실제 입력값을 검증한다.
  @ApiProperty({ description: '로그인 아이디', example: 'senior01' })
  @IsString()
  @Matches(/^[a-zA-Z0-9]{4,20}$/, {
    message: '아이디는 영문과 숫자만 사용해 4~20자로 입력해주세요.',
  })
  loginId!: string;

  @ApiProperty({
    description: '4~72자의 비밀번호',
    example: 'password123!',
  })
  @IsString()
  @MinLength(4, { message: '비밀번호는 4자 이상이어야 합니다.' })
  @MaxLength(72, { message: '비밀번호는 72자 이하여야 합니다.' })
  password!: string;

  @ApiProperty({
    description: '비밀번호 확인',
    example: 'password123!',
  })
  @IsString()
  passwordConfirm!: string;

  @ApiProperty({ description: '사용자 이름', example: '홍길동' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiProperty({
    description: '휴대폰 번호(하이픈 포함·미포함 허용)',
    example: '010-1234-5678',
  })
  @Transform(({ value }) => normalizePhoneNumber(value))
  @IsString()
  @Matches(/^01[016789]\d{7,8}$/, {
    message: '올바른 휴대폰 번호를 입력해주세요.',
  })
  phone!: string;

  @ApiProperty({
    description: '사용자 역할',
    enum: UserRole,
    example: UserRole.SENIOR,
  })
  @IsEnum(UserRole, { message: 'role은 SENIOR 또는 GUARDIAN이어야 합니다.' })
  role!: UserRole;

  @ApiProperty({ description: '필수 약관 동의 여부', example: true })
  @Equals(true, { message: '필수 약관에 동의해야 합니다.' })
  termsAgreed!: boolean;
}
