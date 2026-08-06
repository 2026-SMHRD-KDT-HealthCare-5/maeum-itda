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
import { VoiceEmotionAnalysis } from './entities/voice-emotion-analysis.entity';

// AI 분석 객체와 분석 결과 Repository를 등록한다.
// exports의 AnalysisService는 ChatsService에서 주입받아 사용할 수 있다.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScaleQuestionAnalysis,
      EmotionTag,
      VoiceEmotionAnalysis,
    ]),
  ],
  providers: [AnalysisService, AiClient],
  exports: [AnalysisService],
})
export class AnalysisModule {}
