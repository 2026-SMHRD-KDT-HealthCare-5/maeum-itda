/*
역할: 질문별 복수 답변의 STT·감성·척도 결과와 다음 AI 질문을 하나의 DB 트랜잭션으로 저장한다.
전체 흐름: AnalysisService → AnalysisResultRepository → TypeORM → MySQL
주의: 답변 메시지는 분석이 성공해 실제 transcript가 확정된 이 시점에야 처음 INSERT된다
     (결정사항: 분석 실패 시 CONVERSATION_MESSAGE에 아무 흔적도 남기지 않는다) — 대기/처리
     중 상태를 미리 만들어두고 UPDATE하는 방식이 아니다.
*/
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ConversationMessage,
  SpeakerType,
  SttStatus,
} from '../../chats/entities/conversation-message.entity';
import {
  MessageRelationship,
  MessageRelationshipType,
} from '../../chats/entities/message-relationship.entity';
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

  // 역할: 답변별 분석 결과를 새 MESSAGE_ID로 저장하고 묶음 전체를 바탕으로 만든 다음 질문을 한 번 저장한다.
  async saveCompleted(
    batch: QuestionAnswerBatch,
    nextGenerationId: string,
    result: QuestionAnswerAnalysisResult,
  ): Promise<CompletedAudioAnalysis> {
    return this.dataSource.transaction(async (manager) => {
      const resultByTempId = new Map(
        result.answers.map((answer) => [answer.tempAnswerId, answer]),
      );
      // 같은 질문에 이미 저장된 답변 수만큼 뒤이어 번호가 매겨지도록 시작값을 조회한다
      // (첫 답변은 ANSWER, 그 뒤로 도착한 답변은 ADDITIONAL_ANSWER).
      let answerIndex = await manager.count(MessageRelationship, {
        where: { sourceMessageId: batch.questionMessageId },
      });

      // FastAPI 응답 배열 순서가 아니라 batch.answers(실제 제출 순서) 기준으로 저장해야
      // ANSWER/ADDITIONAL_ANSWER 라벨과 audio:transcript 전달 순서가 뒤섞이지 않는다.
      const answerTranscripts: CompletedAudioAnalysis['answerTranscripts'] = [];
      for (const queuedAnswer of batch.answers) {
        const answer = resultByTempId.get(queuedAnswer.tempAnswerId);
        if (answer === undefined) {
          throw new Error(
            `FastAPI 응답에 tempAnswerId=${queuedAnswer.tempAnswerId} 결과가 없습니다.`,
          );
        }

        const savedAnswer = await manager.save(
          manager.create(ConversationMessage, {
            seniorId: batch.seniorId,
            speakerType: SpeakerType.SENIOR,
            content: answer.transcript,
            sttStatus: SttStatus.COMPLETED,
            sttErrorMessage: null,
          }),
        );
        await manager.save(
          manager.create(MessageRelationship, {
            sourceMessageId: batch.questionMessageId,
            targetMessageId: savedAnswer.messageId,
            relationshipType:
              answerIndex === 0
                ? MessageRelationshipType.ANSWER
                : MessageRelationshipType.ADDITIONAL_ANSWER,
          }),
        );
        answerIndex += 1;

        await manager.save(
          manager.create(VoiceAnalysisStatus, {
            messageId: savedAnswer.messageId,
            processingStatus: ProcessingStatus.COMPLETED,
            analyzedAt: new Date(),
            errorMessage: null,
          }),
        );
        await manager.save(
          manager.create(EmotionTag, {
            messageId: savedAnswer.messageId,
            sentimentLabel: answer.sentimentLabel,
            analyzedAt: new Date(),
          }),
        );
        if (answer.scaleAnalyses.length > 0) {
          await manager.save(
            answer.scaleAnalyses.map((scale) =>
              manager.create(ScaleQuestionAnalysis, {
                messageId: savedAnswer.messageId,
                ...scale,
              }),
            ),
          );
        }

        answerTranscripts.push({
          messageId: savedAnswer.messageId,
          content: answer.transcript,
        });
      }

      let nextQuestion: CompletedAudioAnalysis['nextQuestion'] = null;
      if (batch.continueConversation) {
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
        answerTranscripts,
        nextQuestion,
      };
    });
  }

  findStatus(messageId: number): Promise<VoiceAnalysisStatus | null> {
    return this.dataSource
      .getRepository(VoiceAnalysisStatus)
      .findOne({ where: { messageId } });
  }

  // 역할: REST 조회/재시도 엔드포인트의 소유권 검증을 위해 메시지가 속한 시니어를 확인한다.
  async findMessageSeniorId(messageId: number): Promise<number | null> {
    const message = await this.dataSource
      .getRepository(ConversationMessage)
      .findOne({ where: { messageId }, select: { seniorId: true } });
    return message?.seniorId ?? null;
  }
}
