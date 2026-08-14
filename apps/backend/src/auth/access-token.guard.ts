/*
역할: REST 요청의 Bearer Access Token을 검증하고 인증 사용자 정보를 요청에 연결한다.
전체 흐름: Authorization 헤더 → AccessTokenGuard → AuthService → Controller
*/
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AccessTokenPayload } from './auth.service';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const [scheme, accessToken] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !accessToken) {
      throw new UnauthorizedException('인증 정보가 필요합니다.');
    }

    request.user = await this.authService.verifyAccessToken(accessToken);
    return true;
  }
}
