/*
역할: 음성으로 접수한 시니어 답변 메시지와 AI 질문 관계를 하나의 트랜잭션으로 저장한다.
연결 객체: CONVERSATION_MESSAGE, MESSAGE_RELATIONSHIP, TypeORM DataSource
전체 흐름: AudioBinaryHandler → savePendingAnswer() → 메시지 저장 → 관계 저장 → messageId 반환
*/
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ConversationMessage,
  SpeakerType,
  SttStatus,
} from '../entities/conversation-message.entity';
import {
  MessageRelationship,
  MessageRelationshipType,
} from '../entities/message-relationship.entity';

@Injectable()
export class AudioAnswerRepository {
  constructor(private readonly dataSource: DataSource) {}

  async savePendingAnswer(
    seniorId: number,
    questionMessageId: number,
  ): Promise<ConversationMessage> {
    // 메시지만 저장되고 관계 저장이 실패하는 불완전 상태를 막기 위해 같은 트랜잭션을 사용한다.
    return this.dataSource.transaction(async (manager) => {
      const existingAnswerCount = await manager.count(MessageRelationship, {
        where: { sourceMessageId: questionMessageId },
      });
      const relationshipType =
        existingAnswerCount === 0
          ? MessageRelationshipType.ANSWER
          : MessageRelationshipType.ADDITIONAL_ANSWER;

      const answer = manager.create(ConversationMessage, {
        seniorId,
        speakerType: SpeakerType.SENIOR,
        content: null,
        sttStatus: SttStatus.WAITING,
        sttErrorMessage: null,
      });
      const savedAnswer = await manager.save(answer);

      const relationship = manager.create(MessageRelationship, {
        sourceMessageId: questionMessageId,
        targetMessageId: savedAnswer.messageId,
        relationshipType,
      });
      await manager.save(relationship);

      return savedAnswer;
    });
  }
}
