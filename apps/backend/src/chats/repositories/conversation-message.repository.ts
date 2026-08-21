/*
역할: CONVERSATION_MESSAGE 테이블의 대화 메시지 생성·저장 처리
연결 객체: TypeORM Repository<ConversationMessage>, ConversationMessage Entity
전체 흐름: ChatsService → ConversationMessageRepository → TypeORM Repository → MySQL
*/
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  ConversationMessage,
  SpeakerType,
  SttStatus,
} from '../entities/conversation-message.entity';

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

  // 역할: GET /chats/tts-stream이 스트리밍할 AI 질문의 텍스트를 조회한다.
  // 다른 시니어의 질문이거나 AI 질문이 아니면(또는 없으면) null을 반환한다.
  async findAiQuestionContent(
    messageId: number,
    seniorId: number,
  ): Promise<string | null> {
    const message = await this.typeOrmRepository.findOneBy({
      messageId,
      seniorId,
      speakerType: SpeakerType.AI,
    });
    return message?.content ?? null;
  }

  // 역할: 서버 재시작 등으로 메모리 상의 진행 상태(ChatConnectionStateService)가
  // 사라진 뒤 같은 날 재접속했을 때, 오늘 마지막 메시지가 아직 답변되지 않은
  // AI 질문인지 DB로 직접 판단하기 위해 오늘의 가장 최근 메시지 한 건을 조회한다.
  async findLatestMessageToday(
    seniorId: number,
    start: Date,
    end: Date,
  ): Promise<ConversationMessage | null> {
    return this.typeOrmRepository.findOne({
      where: { seniorId, createdAt: Between(start, end) },
      order: { messageId: 'DESC' },
    });
  }
}
