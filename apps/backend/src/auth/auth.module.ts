/**
 * 역할: JWT 기능과 인증에 필요한 Provider를 NestJS에 등록한다.
 * 전체 흐름: AppModule → AuthModule → AuthService → JwtService
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
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
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
