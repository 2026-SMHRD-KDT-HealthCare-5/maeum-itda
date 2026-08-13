/*
역할: 로그인 요청 body의 아이디와 비밀번호 형식을 검증한다.
전체 흐름: HTTP body → ValidationPipe → LoginDto → AuthController → AuthService
*/
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: '로그인 아이디', example: 'senior01' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{4,50}$/, {
    message: '아이디 또는 비밀번호가 일치하지 않습니다.',
  })
  loginId: string;

  @ApiProperty({ description: '비밀번호', example: 'password123!' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
