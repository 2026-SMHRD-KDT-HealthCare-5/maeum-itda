/* 역할: REST Guard가 Bearer 토큰을 검증하고 인증 사용자를 요청에 연결하는지 검증한다. */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../users/entities/user.entity';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';

describe('AccessTokenGuard', () => {
  const authService = { verifyAccessToken: jest.fn() };
  const guard = new AccessTokenGuard(authService as unknown as AuthService);

  function contextFor(authorization?: string) {
    const request = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => jest.clearAllMocks());

  it('유효한 Bearer 토큰의 사용자 정보를 요청에 연결한다', async () => {
    const { context, request } = contextFor('Bearer valid-token');
    authService.verifyAccessToken.mockResolvedValue({
      sub: 1,
      role: UserRole.SENIOR,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(request).toHaveProperty('user', {
      sub: 1,
      role: UserRole.SENIOR,
    });
  });

  it('Bearer 토큰이 없으면 요청을 거절한다', async () => {
    const { context } = contextFor();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
