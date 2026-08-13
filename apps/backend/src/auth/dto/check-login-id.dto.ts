/*
역할: 아이디 중복 확인 요청의 데이터 형식과 검증 규칙을 정의한다.
전체 흐름: HTTP query → ValidationPipe → CheckLoginIdDto → AuthController → AuthService
*/
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CheckLoginIdDto {
  // Swagger 설명을 만들고 class-validator가 실제 loginId 형식을 검증한다.
  @ApiProperty({
    description: '중복 여부를 확인할 로그인 아이디',
    example: 'senior01',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9]{4,20}$/, {
    message: '아이디는 영문과 숫자만 사용해 4~20자로 입력해주세요.',
  })
  loginId!: string;
}
