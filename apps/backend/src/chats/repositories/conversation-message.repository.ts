/*
역할: CONVERSATION_MESSAGE 테이블의 대화 메시지 생성·저장·조회 처리
연결 객체: TypeORM Repository<ConversationMessage>, ConversationMessage Entity
전체 흐름: ChatsService → ConversationMessageRepository → TypeORM Repository → MySQL
*/
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConversationMessage,
  SpeakerType,
  SttStatus,
} from '../entities/conversation-message.entity';
import { toChatDayUtcRange } from '../lib/chat-date-range';

@Injectable()
export class ConversationMessageRepository {
  private readonly typeOrmRepository: Repository<ConversationMessage>; // TypeORM이 제공하는 기본 DB 처리 객체

  // NestJS DI 컨테이너가 ConversationMessage Entity의 TypeORM Repository를 주입
  constructor(
    @InjectRepository(ConversationMessage)
    typeOrmRepository: Repository<ConversationMessage>,
  ) {
    this.typeOrmRepository = typeOrmRepository;
  }

  // 역할: 최초 AI 질문 객체 생성과 INSERT 실행
  // 연결 객체: TypeORM Repository<ConversationMessage>
  // 다음 호출: create() → save() → ChatsService.startChat()
  async saveInitialAiQuestion(
    seniorId: number,
    content: string,
  ): Promise<ConversationMessage> {
    // Entity 형식의 AI 질문 객체 생성: 아직 INSERT가 실행되는 단계는 아님
    const initialQuestion = this.typeOrmRepository.create({
      seniorId,
      speakerType: SpeakerType.AI,
      content,
      sttStatus: SttStatus.NOT_REQUIRED,
      sttErrorMessage: null,
    });

    // INSERT 실행 후 MySQL이 발급한 MESSAGE_ID를 포함한 객체 반환
    return this.typeOrmRepository.save(initialQuestion);
  }

  // 역할: 오늘(Asia/Seoul) 이 시니어의 가장 최근 메시지 한 건을 조회한다.
  // 연결 흐름: ChatsService.startChat()이 재진입 시 새 고정 질문 대신 이 결과로
  // 이어갈지 판단하는 데 쓴다. 오늘 메시지가 하나도 없으면 null을 반환한다.
  async findLastMessageForToday(
    seniorId: number,
    todaySeoulDate: string,
  ): Promise<ConversationMessage | null> {
    const { start, end } = toChatDayUtcRange(todaySeoulDate);
    return this.typeOrmRepository
      .createQueryBuilder('message')
      .where('message.seniorId = :seniorId', { seniorId })
      .andWhere('message.createdAt >= :start', { start })
      .andWhere('message.createdAt < :end', { end })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.messageId', 'DESC')
      .getOne();
  }
}
