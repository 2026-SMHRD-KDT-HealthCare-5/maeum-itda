/*
역할: 질문별 복수 답변의 STT·감성·척도 결과와 다음 AI 질문을 하나의 DB 트랜잭션으로 저장한다.
전체 흐름: AnalysisService → AnalysisResultRepository → TypeORM → MySQL
주의: 이전·다음 답변 컬럼을 만들지 않고 각 답변은 고유 MESSAGE_ID와 SPEAKER_TYPE으로 저장한다.
*/
import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  ConversationMessage,
  SpeakerType,
  SttStatus,
} from '../../chats/entities/conversation-message.entity';
import {
  CompletedAudioAnalysis,
  QuestionAnswerAnalysisResult,
  QuestionAnswerBatch,
} from '../dto/audio-analysis.contract';
import { EmotionTag } from '../entities/emotion-tag.entity';
import { ScaleQuestionAnalysis } from '../entities/scale-question-analysis.entity';
import {
  ProcessingStatus,
  VoiceAnalysisStatus,
} from '../entities/voice-analysis-status.entity';

@Injectable()
export class AnalysisResultRepository {
  constructor(private readonly dataSource: DataSource) {}

  // 역할: 큐가 확정된 모든 시니어 답변의 음성 분석 상태를 WAITING으로 만든다.
  async markWaiting(messageIds: number[]): Promise<void> {
    const repository = this.dataSource.getRepository(VoiceAnalysisStatus);
    for (const messageId of messageIds) {
      const existing = await repository.findOne({ where: { messageId } });
      await repository.save(
        repository.create({
          ...existing,
          messageId,
          processingStatus: ProcessingStatus.WAITING,
          analyzedAt: null,
          errorMessage: null,
        }),
      );
    }
  }

  // 역할: FastAPI 호출 직전에 묶음의 모든 음성·STT 상태를 PROCESSING으로 변경한다.
  async markProcessing(messageIds: number[]): Promise<void> {
    await this.dataSource.getRepository(VoiceAnalysisStatus).update(
      { messageId: In(messageIds) },
      {
        processingStatus: ProcessingStatus.PROCESSING,
        analyzedAt: null,
        errorMessage: null,
      },
    );
    await this.dataSource
      .getRepository(ConversationMessage)
      .update(
        { messageId: In(messageIds) },
        { sttStatus: SttStatus.PROCESSING, sttErrorMessage: null },
      );
  }

  // 역할: 답변별 분석 결과를 각 MESSAGE_ID에 저장하고 묶음 전체를 바탕으로 만든 다음 질문을 한 번 저장한다.
  async saveCompleted(
    batch: QuestionAnswerBatch,
    nextGenerationId: string,
    result: QuestionAnswerAnalysisResult,
  ): Promise<CompletedAudioAnalysis> {
    return this.dataSource.transaction(async (manager) => {
      for (const answer of result.answers) {
        await manager.update(
          ConversationMessage,
          { messageId: answer.messageId },
          {
            content: answer.transcript,
            sttStatus: SttStatus.COMPLETED,
            sttErrorMessage: null,
          },
        );
        await manager.update(
          VoiceAnalysisStatus,
          { messageId: answer.messageId },
          {
            processingStatus: ProcessingStatus.COMPLETED,
            analyzedAt: new Date(),
            errorMessage: null,
          },
        );
        // 같은 답변을 재분석해도 MESSAGE_ID unique 충돌 없이 최신 감정 결과로 갱신한다.
        await manager.upsert(
          EmotionTag,
          {
            messageId: answer.messageId,
            sentimentLabel: answer.sentimentLabel,
            analyzedAt: new Date(),
          },
          ['messageId'],
        );

        // FastAPI 재시도 결과를 답변별 최신 스냅샷으로 교체해 중복과 이전 분석 잔존을 함께 막는다.
        await manager.delete(ScaleQuestionAnalysis, {
          messageId: answer.messageId,
        });
        if (answer.scaleAnalyses.length > 0) {
          await manager.save(
            answer.scaleAnalyses.map((scale) =>
              manager.create(ScaleQuestionAnalysis, {
                messageId: answer.messageId,
                ...scale,
              }),
            ),
          );
        }
      }

      let nextQuestion: CompletedAudioAnalysis['nextQuestion'] = null;
      if (batch.continueConversation && result.nextQuestion !== null) {
        const savedQuestion = await manager.save(
          manager.create(ConversationMessage, {
            seniorId: batch.seniorId,
            speakerType: SpeakerType.AI,
            content: result.nextQuestion,
            sttStatus: SttStatus.NOT_REQUIRED,
            sttErrorMessage: null,
          }),
        );
        nextQuestion = {
          messageId: savedQuestion.messageId,
          generationId: nextGenerationId,
          content: savedQuestion.content ?? result.nextQuestion,
        };
      }
      return {
        answerMessageIds: batch.answers.map(({ messageId }) => messageId),
        nextQuestion,
      };
    });
  }

  // 역할: 요청 또는 저장 실패를 묶음의 모든 답변에 동일하게 기록해 재시도 대상을 보존한다.
  async markFailed(messageIds: number[], errorMessage: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        ConversationMessage,
        { messageId: In(messageIds) },
        { sttStatus: SttStatus.FAILED, sttErrorMessage: errorMessage },
      );
      await manager.update(
        VoiceAnalysisStatus,
        { messageId: In(messageIds) },
        {
          processingStatus: ProcessingStatus.FAILED,
          analyzedAt: null,
          errorMessage,
        },
      );
    });
  }

  findStatus(messageId: number): Promise<VoiceAnalysisStatus | null> {
    return this.dataSource
      .getRepository(VoiceAnalysisStatus)
      .findOne({ where: { messageId } });
  }
}
