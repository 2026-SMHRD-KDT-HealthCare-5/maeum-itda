/**
 * 역할: AI 분석 Service, FastAPI Client, 분석 Entity Repository를 등록한다.
 * 전체 흐름: ChatsService → AnalysisService → AiClient
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiClient } from './ai.client';
import { AnalysisService } from './analysis.service';
import { EmotionTag } from './entities/emotion-tag.entity';
import { ScaleQuestionAnalysis } from './entities/scale-question-analysis.entity';
import { VoiceAnalysisStatus } from './entities/voice-analysis-status.entity';
import { ConversationMessage } from '../chats/entities/conversation-message.entity';
import { AnalysisController } from './analysis.controller';
import { AnalysisResultRepository } from './repositories/analysis-result.repository';
import { TemporaryAudioRepository } from './repositories/temporary-audio.repository';
import { TtsClient } from './tts.client';

// 역할: 분석 REST 진입점, 업무 Service, FastAPI Client와 DB·메모리 Repository를 등록한다.
// 연결 흐름: ChatsModule → AnalysisService → AiClient/Repository이며 외부에는 AnalysisService만 공개한다.
// AI 분석 객체와 분석 결과 Repository를 등록한다.
// exports의 AnalysisService는 ChatsService에서 주입받아 사용할 수 있다.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScaleQuestionAnalysis,
      EmotionTag,
      VoiceAnalysisStatus,
      ConversationMessage,
    ]),
  ],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    AiClient,
    TtsClient,
    AnalysisResultRepository,
    TemporaryAudioRepository,
  ],
  exports: [AnalysisService, TtsClient],
})
export class AnalysisModule {}
