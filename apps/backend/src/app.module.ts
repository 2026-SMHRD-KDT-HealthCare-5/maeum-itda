/*
 역할: 백엔드의 환경설정과 기능별 모듈을 한곳에서 등록한다.
 전체 흐름: main.ts → AppModule → 기능별 Module
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalysisModule } from './analysis/analysis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { ConnectionsModule } from './connections/connections.module';
import { GuardianDashboardModule } from './guardian-dashboard/guardian-dashboard.module';
import databaseConfig from './config/database.config';
import webPushConfig from './config/web-push.config';
import { NotificationsModule } from './notifications/notifications.module';
import { ProfileSettingsModule } from './profile-settings/profile-settings.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';

// 루트 모듈에 환경설정·DB·기능 모듈을 등록한다.
// NestJS는 메타데이터를 읽어 하위 모듈과 Provider를 초기화한다.
@Module({
  imports: [
    // .env와 프로젝트 설정을 등록하고 ConfigService를 전역에서 사용하게 한다.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/backend/.env', '.env'],
      load: [databaseConfig, webPushConfig],
    }),

    // ConfigService에서 DB 설정을 조회해 TypeORM 연결을 생성한다.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow<TypeOrmModuleOptions>('database'),
    }),
    // @Cron 리포트 작업을 모든 기능 모듈이 초기화된 뒤 등록한다.
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ChatsModule,
    ConnectionsModule,
    GuardianDashboardModule,
    AnalysisModule,
    ReportsModule,
    NotificationsModule,
    ProfileSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
