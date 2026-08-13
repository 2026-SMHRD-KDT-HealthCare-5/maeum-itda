/*
역할: 아이디 중복 확인과 회원가입 성공 응답을 OpenAPI 스키마로 제공한다.
연결 흐름: AuthController → AuthService 반환값 → 응답 DTO 문서 → 프론트 생성 타입
*/
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class CheckLoginIdResponseDto {
  @ApiProperty({
    description: '중복 여부를 확인한 로그인 아이디',
    example: 'senior01',
  })
  loginId!: string;

  @ApiProperty({ description: '아이디 사용 가능 여부', example: true })
  available!: boolean;

  @ApiProperty({
    description: '사용 가능 여부 안내 문구',
    example: '사용할 수 있는 아이디입니다.',
  })
  message!: string;
}

export class SignUpResponseDto {
  @ApiProperty({ description: '생성된 사용자 ID', example: 1 })
  userId!: number;

  @ApiProperty({ description: '로그인 아이디', example: 'senior01' })
  loginId!: string;

  @ApiProperty({ description: '사용자 이름', example: '홍길동' })
  name!: string;

  @ApiProperty({
    description: '하이픈을 제외한 휴대전화 번호',
    example: '01012345678',
  })
  phone!: string;

  @ApiProperty({
    description: '사용자 역할',
    enum: UserRole,
    example: UserRole.SENIOR,
  })
  role!: UserRole;

  @ApiProperty({
    description: '회원가입 시각',
    example: '2026-08-13T09:00:00.000Z',
    format: 'date-time',
  })
  joinedAt!: Date;
}

export class AuthenticatedUserResponseDto extends SignUpResponseDto {}

export class LoginResponseDto {
  @ApiProperty({
    description: 'REST와 WebSocket 인증에 사용할 JWT Access Token',
  })
  accessToken!: string;

  @ApiProperty({ type: AuthenticatedUserResponseDto })
  user!: AuthenticatedUserResponseDto;
}
