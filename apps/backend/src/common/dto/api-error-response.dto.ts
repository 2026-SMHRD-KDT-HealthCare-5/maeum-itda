/*
역할: NestJS REST API의 기본 오류 응답을 Swagger 문서에서 공통으로 표현한다.
연결 흐름: Controller 예외 응답 → ApiErrorResponseDto 문서 → OpenAPI JSON → 프론트 API 생성
주의: 실제 예외 변환 로직을 변경하지 않고 NestJS 기본 HttpException 응답 구조만 기술한다.
*/
import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ description: 'HTTP 상태 코드', example: 400 })
  statusCode: number;

  @ApiProperty({
    description: '오류 메시지 또는 ValidationPipe가 반환한 메시지 목록',
    oneOf: [
      { type: 'string', example: '요청값이 올바르지 않습니다.' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['loginId는 필수입니다.'],
      },
    ],
  })
  message: string | string[];

  @ApiProperty({ description: 'HTTP 오류 이름', example: 'Bad Request' })
  error: string;
}
