/* 역할: 보호자가 연결 요청을 보낼 시니어의 로그인 아이디를 검증한다. */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreateConnectionRequestDto {
  @ApiProperty({
    description: '연결할 시니어 로그인 아이디',
    example: 'senior01',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9]{4,20}$/, {
    message: '시니어 아이디 형식이 올바르지 않습니다.',
  })
  seniorLoginId!: string;
}
