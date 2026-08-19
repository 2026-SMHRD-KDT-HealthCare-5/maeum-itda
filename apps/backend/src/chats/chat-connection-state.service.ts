/*
역할: WebSocket 연결별 현재 AI 질문 식별정보 관리
연결 객체: ChatStartHandler, AudioMetadataHandler, ChatsGateway
전체 흐름: chat:start → 현재 질문 저장 → audio:metadata 식별정보 검증 → 연결 종료 시 제거
[완료] 같은 프로세스 안의 단기 재접속에서는 시니어 ID로 현재 질문을 복원한다.
[제약] 상태가 메모리에 있어 서버 재시작·다중 인스턴스·다른 서버로의 재접속에서는 복원되지 않는다.
*/
import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';
import type { AiQuestionPayload } from '@maeum-itda/shared-types';

export interface CurrentQuestionState {
  questionMessageId: number;
  generationId: string;
  content: string;
}

@Injectable()
export class ChatConnectionStateService {
  private readonly currentQuestionByClient: WeakMap<
    WebSocket,
    CurrentQuestionState
  >; // 연결별 현재 유효한 AI 질문
  private readonly endedClients: WeakSet<WebSocket>; // 수동 종료 후 늦게 도착한 분석 결과의 질문 전송 차단
  private readonly seniorIdByClient = new WeakMap<WebSocket, number>();
  private readonly currentQuestionBySeniorId = new Map<
    number,
    CurrentQuestionState
  >();
  private readonly knownQuestionsByClient = new WeakMap<
    WebSocket,
    Map<number, CurrentQuestionState>
  >();
  // chat:start 처리 중(DB 저장 완료 전)인 연결 표시. 활성 질문 존재 여부 체크와
  // 질문 저장 사이에는 await로 인한 틈이 있어, 이 표시가 없으면 짧은 간격으로
  // 도착한 두 번째 chat:start가 같은 틈을 통과해 질문이 중복 생성될 수 있다.
  private readonly startingClients = new WeakSet<WebSocket>();

  constructor() {
    this.currentQuestionByClient = new WeakMap<
      WebSocket,
      CurrentQuestionState
    >();
    this.endedClients = new WeakSet<WebSocket>();
  }

  // 역할: chat:start 처리 시작을 동기적으로 표시해 중복 요청을 차단한다.
  // 연결 흐름: ChatStartHandler가 활성 질문 체크 직후, startChat() 호출 전에 호출.
  isStarting(client: WebSocket): boolean {
    return this.startingClients.has(client);
  }

  markStarting(client: WebSocket): void {
    this.startingClients.add(client);
  }

  // 연결 흐름: ChatStartHandler가 startChat() 완료(성공/실패 무관) 직후 finally에서 호출.
  clearStarting(client: WebSocket): void {
    this.startingClients.delete(client);
  }

  // 역할: DB 저장이 완료된 현재 AI 질문 식별정보 보관
  // 다음 호출: AudioMetadataHandler의 질문 식별정보 검증
  setCurrentQuestion(
    client: WebSocket,
    startedChat: AiQuestionPayload,
    seniorId?: number,
  ): void {
    // 새 chat:start가 처리되면 같은 연결에서 이전 대화의 종료 표시를 해제한다.
    this.endedClients.delete(client);
    const state: CurrentQuestionState = {
      questionMessageId: startedChat.messageId,
      generationId: startedChat.generationId,
      content: startedChat.content,
    };
    this.currentQuestionByClient.set(client, state);
    let knownQuestions = this.knownQuestionsByClient.get(client);
    if (knownQuestions === undefined) {
      knownQuestions = new Map<number, CurrentQuestionState>();
      this.knownQuestionsByClient.set(client, knownQuestions);
    }
    knownQuestions.set(state.questionMessageId, state);
    const resolvedSeniorId = seniorId ?? this.seniorIdByClient.get(client);
    if (resolvedSeniorId !== undefined) {
      this.seniorIdByClient.set(client, resolvedSeniorId);
      this.currentQuestionBySeniorId.set(resolvedSeniorId, state);
    }
  }

  // 역할: 같은 시니어가 새 WebSocket으로 재접속하면 서버 메모리에 남은 현재 질문을 복원한다.
  restoreClient(
    client: WebSocket,
    seniorId: number,
  ): CurrentQuestionState | undefined {
    const state = this.currentQuestionBySeniorId.get(seniorId);
    if (state === undefined) return undefined;
    this.seniorIdByClient.set(client, seniorId);
    this.currentQuestionByClient.set(client, state);
    this.knownQuestionsByClient.set(
      client,
      new Map([[state.questionMessageId, state]]),
    );
    this.endedClients.delete(client);
    return state;
  }

  // 역할: audio:metadata가 현재 AI 질문에 대한 답변인지 확인
  matchesCurrentQuestion(
    client: WebSocket,
    questionMessageId: number,
    generationId: string,
  ): boolean {
    const currentQuestion = this.currentQuestionByClient.get(client);
    return (
      currentQuestion?.questionMessageId === questionMessageId &&
      currentQuestion.generationId === generationId
    );
  }

  // 역할: 현재 질문 또는 같은 연결에서 이미 전달한 이전 질문인지 확인해 늦은 추가 답변도 보존한다.
  matchesKnownQuestion(
    client: WebSocket,
    questionMessageId: number,
    generationId: string,
  ): boolean {
    const question = this.knownQuestionsByClient
      .get(client)
      ?.get(questionMessageId);
    return question?.generationId === generationId;
  }

  // 역할: 수동 종료 시 아직 대기 중인 질문별 답변 큐를 확정할 현재 질문 ID를 반환한다.
  // 연결 흐름: ChatEndHandler → 현재 질문 조회 → QuestionAnswerQueueService.flush()
  getCurrentQuestion(client: WebSocket): CurrentQuestionState | undefined {
    return this.currentQuestionByClient.get(client);
  }

  // 역할: 대화 종료/유휴 타임아웃 시점에 정서지수 즉시 재계산을 트리거할 seniorId를 조회한다.
  // 연결 흐름: ChatEndHandler/ChatInactivityService → markChatEnded 이전에 호출해야 한다
  // (markChatEnded가 이 매핑을 지운다).
  getSeniorId(client: WebSocket): number | undefined {
    return this.seniorIdByClient.get(client);
  }

  // 역할: chat:end 이후 진행 중 분석은 저장하되 다음 ai:question은 보내지 않도록 표시한다.
  markChatEnded(client: WebSocket): void {
    const seniorId = this.seniorIdByClient.get(client);
    if (seniorId !== undefined) this.currentQuestionBySeniorId.delete(seniorId);
    this.endedClients.add(client);
    this.currentQuestionByClient.delete(client);
    this.seniorIdByClient.delete(client);
    this.knownQuestionsByClient.delete(client);
  }

  isChatEnded(client: WebSocket): boolean {
    return this.endedClients.has(client);
  }

  // 역할: WebSocket 종료 시 연결별 현재 질문 상태 제거
  clearClient(client: WebSocket): void {
    this.currentQuestionByClient.delete(client);
    this.seniorIdByClient.delete(client);
    this.knownQuestionsByClient.delete(client);
    this.endedClients.delete(client);
    this.startingClients.delete(client);
  }
}
