/*
역할: WebSocket 연결별 현재 AI 질문 식별정보 관리
연결 객체: ChatStartHandler, AudioMetadataHandler, ChatsGateway
전체 흐름: chat:start → 현재 질문 저장 → audio:metadata 식별정보 검증 → 연결 종료 시 제거
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import type { StartedChat } from './chats.service';

export interface CurrentQuestionState {
  aiQuestionMessageId: number;
  generationId: string;
}

@Injectable()
export class ChatConnectionStateService {
  private readonly currentQuestionByClient: WeakMap<
    WebSocket,
    CurrentQuestionState
  >; // 연결별 현재 유효한 AI 질문

  constructor() {
    this.currentQuestionByClient = new WeakMap<
      WebSocket,
      CurrentQuestionState
    >();
  }

  // 역할: DB 저장이 완료된 현재 AI 질문 식별정보 보관
  // 다음 호출: AudioMetadataHandler의 질문 식별정보 검증
  setCurrentQuestion(client: WebSocket, startedChat: StartedChat): void {
    this.currentQuestionByClient.set(client, {
      aiQuestionMessageId: startedChat.aiQuestionMessageId,
      generationId: startedChat.generationId,
    });
  }

  // 역할: audio:metadata가 현재 AI 질문에 대한 답변인지 확인
  matchesCurrentQuestion(
    client: WebSocket,
    aiQuestionMessageId: number,
    generationId: string,
  ): boolean {
    const currentQuestion = this.currentQuestionByClient.get(client);
    return (
      currentQuestion?.aiQuestionMessageId === aiQuestionMessageId &&
      currentQuestion.generationId === generationId
    );
  }

  // 역할: WebSocket 종료 시 연결별 현재 질문 상태 제거
  clearClient(client: WebSocket): void {
    this.currentQuestionByClient.delete(client);
  }
}
