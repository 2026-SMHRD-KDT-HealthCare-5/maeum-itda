/**
 * 역할: JWT 기능과 인증에 필요한 Provider를 NestJS에 등록한다.
 * 전체 흐름: AppModule → AuthModule → AuthService → JwtService
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { UsersController } from '../users/users.controller';
import { AuthController } from './auth.controller';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';

// UsersService와 JwtService를 AuthService에 주입할 수 있도록 등록한다.
// exports의 AuthService는 ChatsModule과 ChatsGateway에서 사용할 수 있다.
@Module({
  imports: [
    UsersModule,
    // ConfigService에서 JWT 비밀키를 조회해 JwtService를 생성한다.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  // 인증이 필요한 사용자 REST Controller도 이 모듈에 등록해 AuthService/Guard와
  // UsersService 사이의 역방향 모듈 의존성을 만들지 않는다.
  controllers: [AuthController, UsersController],
  providers: [AuthService, AccessTokenGuard],
  exports: [AuthService, AccessTokenGuard],
})
export class AuthModule {}
