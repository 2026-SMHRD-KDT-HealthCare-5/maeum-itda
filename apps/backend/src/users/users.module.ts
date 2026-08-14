/*
역할: 사용자 기능의 Controller, Service, Entity Repository를 등록한다.
전체 흐름: AppModule → UsersModule → UsersController 또는 UsersService
*/
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { GuardianSeniorRelationship } from './entities/guardian-senior-relationship.entity';
import { UsersService } from './users.service';

// User 관련 Repository와 Provider를 등록하고 UsersService를 AuthModule에 공개한다.
@Module({
  imports: [TypeOrmModule.forFeature([User, GuardianSeniorRelationship])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
