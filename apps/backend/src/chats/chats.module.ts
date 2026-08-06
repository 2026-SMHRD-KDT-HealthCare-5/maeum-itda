/*
역할: 채팅에 필요한 Gateway, Service, Entity Repository를 NestJS에 등록한다.
전체 흐름: AppModule → ChatsModule → ChatsGateway
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisModule } from '../analysis/analysis.module';
import { ChatsController } from './chats.controller';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { ConversationMessage } from './entities/conversation-message.entity';
import { MessageRelationship } from './entities/message-relationship.entity';
import { AuthModule } from '../auth/auth.module';

// 인증·AI 분석·DB Repository를 가져오고 채팅의 입구와 업무 객체를 등록한다.
// NestJS DI 컨테이너는 등록된 객체의 생성자를 확인해 필요한 의존성을 주입한다.
@Module({
  imports: [
    AuthModule,
    AnalysisModule,
    TypeOrmModule.forFeature([ConversationMessage, MessageRelationship]),
  ],
  controllers: [ChatsController],
  providers: [ChatsGateway, ChatsService],
})
export class ChatsModule {}
