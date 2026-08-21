/*
역할: 채팅에 필요한 Gateway, Handler, Service, Entity Repository를 NestJS에 등록한다.
연결 객체: AuthModule, AnalysisModule, TypeORM Repository
전체 흐름: AppModule → ChatsModule → ChatsGateway → Handler → Service
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisModule } from '../analysis/analysis.module';
import { ReportsModule } from '../reports/reports.module';
import { ChatsController } from './chats.controller';
import { TtsStreamController } from './tts-stream.controller';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { ConversationMessage } from './entities/conversation-message.entity';
import { MessageRelationship } from './entities/message-relationship.entity';
import { AuthModule } from '../auth/auth.module';
import { ChatAuthHandler } from './handlers/chat-auth.handler';
import { ChatStartHandler } from './handlers/chat-start.handler';
import { ConversationMessageRepository } from './repositories/conversation-message.repository';
import { AudioMetadataHandler } from './handlers/audio-metadata.handler';
import { ChatConnectionStateService } from './chat-connection-state.service';
import { AudioBinaryHandler } from './handlers/audio-binary.handler';
import { QuestionAnswerQueueService } from './question-answer-queue.service';
import { ChatEndHandler } from './handlers/chat-end.handler';
import { AudioTransferStateService } from './audio-transfer-state.service';
import { ChatInactivityService } from './chat-inactivity.service';
import { ChatHistoryQueryService } from './chat-history-query.service';
import { ChatHistoryRepository } from './repositories/chat-history.repository';
import { LastTurnRecalcTimerService } from './last-turn-recalc-timer.service';
import { QuestionDeliveryService } from './question-delivery.service';

// 인증·AI 분석·DB Repository를 가져오고 채팅의 입구와 업무 객체를 등록한다.
// NestJS DI 컨테이너는 등록된 객체의 생성자를 확인해 필요한 의존성을 주입한다.
@Module({
  imports: [
    AuthModule,
    AnalysisModule,
    ReportsModule,
    TypeOrmModule.forFeature([ConversationMessage, MessageRelationship]),
  ],
  controllers: [ChatsController, TtsStreamController],
  // DI 컨테이너가 Gateway, Handler, Service 객체를 생성하고 생성자에 주입
  providers: [
    ChatsGateway,
    ChatAuthHandler,
    ChatStartHandler,
    ChatEndHandler,
    AudioMetadataHandler,
    AudioBinaryHandler,
    ChatConnectionStateService,
    ChatsService,
    ChatHistoryQueryService,
    ConversationMessageRepository,
    ChatHistoryRepository,
    QuestionAnswerQueueService,
    AudioTransferStateService,
    ChatInactivityService,
    LastTurnRecalcTimerService,
    QuestionDeliveryService,
  ],
})
export class ChatsModule {}
