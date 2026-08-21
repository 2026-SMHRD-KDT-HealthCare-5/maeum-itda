/*
역할: Access Token 검증과 인증·회원가입 업무 규칙을 처리한다.
전체 흐름: ChatAuthHandler → AuthService → JwtService
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { QueryFailedError } from 'typeorm';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SignUpDto } from './dto/sign-up.dto';
import { LoginDto } from './dto/login.dto';

//Gateway JWT 인증 API 설계부분
export interface AccessTokenPayload {
  sub: number;
  role: UserRole;
}

// TTS 스트리밍 REST 엔드포인트(GET /chats/tts-stream) 전용 단기 토큰. <audio src>는
// Authorization 헤더를 못 붙이므로 쿼리 파라미터로 넘길 수 있는 별도의, 아주 짧게
// (기본 액세스 토큰 1시간보다 훨씨 짧게) 사는 토큰을 쓴다 — 세션 토큰 자체를 URL에
// 노출하지 않기 위함. purpose 클레임으로 액세스 토큰과 용도가 섞이지 않게 한다.
export interface TtsStreamTokenPayload {
  purpose: 'tts-stream';
  messageId: number;
  seniorId: number;
}

const TTS_STREAM_TOKEN_TTL = '30s';

// NestJS가 이 클래스를 Provider 객체로 생성하고 다른 클래스에 주입할 수 있게 한다.
@Injectable()
export class AuthService {
  private readonly usersService: UsersService;
  private readonly jwtService: JwtService;

  // NestJS DI 컨테이너가 UsersService와 JwtService 객체를 생성자에 주입한다.
  constructor(usersService: UsersService, jwtService: JwtService) {
    this.usersService = usersService;
    this.jwtService = jwtService;
  }

  // 비밀번호 해시를 비교한 뒤 REST와 WebSocket에서 함께 쓸 Access Token을 발급한다.
  async login(dto: LoginDto) {
    const user = await this.usersService.findByLoginId(dto.loginId);

    if (
      !user ||
      user.withdrawnAt !== null ||
      !(await compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 일치하지 않습니다.',
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.userId,
      role: user.role,
    } satisfies AccessTokenPayload);

    return {
      accessToken,
      user: this.toPublicUser(user),
    };
  }

  // Gateway에서 전달받은 Access Token을 검증하고 인증된 사용자 정보를 반환한다.
  // 호출 흐름: ChatAuthHandler → verifyAccessToken() → JwtService.verifyAsync()
  async verifyAccessToken(accessToken: string): Promise<AccessTokenPayload> {
    try {
      // 실제 JWT 서명과 만료 검증을 JwtService에 요청한다.
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken);

      // 서명 검증 후에도 사용자 ID와 역할 구분 확인한다.
      if (
        typeof payload.sub !== 'number' ||
        !Object.values(UserRole).includes(payload.role)
      ) {
        throw new UnauthorizedException('유효하지 않은 인증정보입니다.');
      }

      // 서명이 유효해도 탈퇴했거나 역할이 변경된 계정이면 기존 토큰 사용을 차단한다.
      const user = await this.usersService.findById(payload.sub);
      if (!user || user.withdrawnAt !== null || user.role !== payload.role) {
        throw new UnauthorizedException('유효하지 않은 인증정보입니다.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
  }

  // 역할: TTS 스트리밍 REST 요청용 단기 토큰을 발급한다.
  // 연결 흐름: AudioBinaryHandler/ChatStartHandler → signTtsStreamToken() → tts:audio payload
  async signTtsStreamToken(
    messageId: number,
    seniorId: number,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        purpose: 'tts-stream',
        messageId,
        seniorId,
      } satisfies TtsStreamTokenPayload,
      { expiresIn: TTS_STREAM_TOKEN_TTL },
    );
  }

  // 역할: GET /chats/tts-stream이 받은 토큰을 검증하고 payload를 반환한다.
  async verifyTtsStreamToken(token: string): Promise<TtsStreamTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<TtsStreamTokenPayload>(token);
      if (
        payload.purpose !== 'tts-stream' ||
        typeof payload.messageId !== 'number' ||
        typeof payload.seniorId !== 'number'
      ) {
        throw new UnauthorizedException('유효하지 않은 인증정보입니다.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
  }

  //REST API중 회원관리 API 로직부분
  // AuthController의 아이디 중복 확인 요청을 UsersService의 DB 조회로 전달한다.
  // 호출 흐름: AuthController → AuthService → UsersService → User Repository → MySQL
  async checkLoginId(loginId: string) {
    const user = await this.usersService.findByLoginId(loginId);
    return {
      loginId,
      available: user === null,
      message:
        user === null
          ? '사용할 수 있는 아이디입니다.'
          : '이미 사용 중인 아이디입니다.',
    };
  }

  // 회원가입 입력값 확인, 비밀번호 해시, 사용자 저장을 순서대로 처리한다.
  async signUp(dto: SignUpDto) {
    // 비밀번호 확인값은 입력 실수 검사에만 사용하고 DB에는 저장하지 않는다.
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException(
        '비밀번호와 비밀번호 확인이 일치하지 않습니다.',
      );
    }

    // 중복 확인 API 호출 여부와 상관없이 실제 저장 직전에 아이디를 다시 확인한다.
    if (await this.usersService.findByLoginId(dto.loginId)) {
      throw new ConflictException('이미 사용 중인 아이디입니다.');
    }

    // 원본 비밀번호 대신 bcrypt 단방향 해시 결과만 저장한다.
    const passwordHash = await hash(dto.password, 10);

    try {
      // 실제 User 객체 생성과 MySQL 저장은 UsersService에 요청한다.
      const user = await this.usersService.create({
        loginId: dto.loginId,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
      });

      // 비밀번호 해시를 제외한 회원 정보만 Controller 응답으로 반환한다.
      return {
        userId: user.userId,
        loginId: user.loginId,
        name: user.name,
        phone: user.phone,
        role: user.role,
        joinedAt: user.joinedAt,
      };
    } catch (error: unknown) {
      if (this.isDuplicateEntry(error)) {
        throw new ConflictException('이미 사용 중인 아이디입니다.');
      }
      throw error;
    }
  }

  // TypeORM 오류 중 MySQL 중복 키 오류인지 확인하는 내부 메서드다.
  private isDuplicateEntry(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;

    const driverError = error.driverError as { code?: string };
    return driverError.code === 'ER_DUP_ENTRY';
  }

  private toPublicUser(user: {
    userId: number;
    loginId: string;
    name: string;
    phone: string;
    role: UserRole;
    joinedAt: Date;
  }) {
    return {
      userId: user.userId,
      loginId: user.loginId,
      name: user.name,
      phone: user.phone,
      role: user.role,
      joinedAt: user.joinedAt,
    };
  }
}
