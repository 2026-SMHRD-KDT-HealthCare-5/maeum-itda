/*
역할: 인증·회원가입 REST API 요청을 받고 검증된 입력값을 AuthService로 전달한다.
전체 흐름: 브라우저 → AuthController → AuthService → UsersService → MySQL
*/
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto';
import { AuthService } from './auth.service';
import {
  CheckLoginIdResponseDto,
  SignUpResponseDto,
} from './dto/auth-response.dto';
import { CheckLoginIdDto } from './dto/check-login-id.dto';
import { SignUpDto } from './dto/sign-up.dto';

// Swagger 문서 그룹과 /auth REST API 기본 경로를 등록한다.
@ApiTags('1. 인증 및 회원관리')
@Controller('auth')
export class AuthController {
  private readonly authService: AuthService;

  // NestJS DI 컨테이너가 AuthService 객체를 생성자에 주입한다.
  constructor(authService: AuthService) {
    this.authService = authService;
  }

  // GET /auth/check-login-id 요청의 query를 DTO로 검증한 뒤 AuthService를 호출한다.
  @Get('check-login-id')
  @HttpCode(200)
  @ApiOperation({ summary: '회원가입 아이디 중복 확인' })
  @ApiOkResponse({
    description: '아이디 사용 가능 여부 반환',
    type: CheckLoginIdResponseDto,
  })
  @ApiBadRequestResponse({
    description: '아이디 형식 검증 실패',
    type: ApiErrorResponseDto,
  })
  checkLoginId(@Query() query: CheckLoginIdDto) {
    return this.authService.checkLoginId(query.loginId);
  }

  // POST /auth/signup 요청의 body를 DTO로 검증한 뒤 AuthService를 호출한다.
  @Post('signup')
  @ApiOperation({ summary: '회원가입' })
  @ApiCreatedResponse({
    description: '회원가입 성공',
    type: SignUpResponseDto,
  })
  @ApiBadRequestResponse({
    description: '요청 데이터 검증 실패',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description: '이미 사용 중인 아이디',
    type: ApiErrorResponseDto,
  })
  signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }
}
