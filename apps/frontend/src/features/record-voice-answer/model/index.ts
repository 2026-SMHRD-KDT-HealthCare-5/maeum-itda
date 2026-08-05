import type { CapturedAnswer, QuestionTurnPhase } from '@maeum-itda/shared-types'

// 결정사항 로그 §5(응답 유실 방지)를 그대로 옮긴 순수 상태 전이 함수 —
// 실제 WebSocket 연동(effect) 없이도 단위 테스트 가능. UI/네트워크 연동은
// 아직 TODO(UC-02)이며, 이 reducer가 그 연동이 따라야 할 상태 규칙이다.
export interface RecordVoiceAnswerState {
  phase: 'idle' | QuestionTurnPhase
  generationId: string | null
  // 질문 생성/출력 중 수집돼 아직 서버에 반영되지 않은 응답들 — 다음
  // generation 요청에 포함시키기 위해 들고 있는다. captureId 기준으로
  // 중복 저장하지 않는다(재전송 대비).
  pendingAnswers: CapturedAnswer[]
  // 뒤늦게 도착한 결과를 무시하기 위해 기억해두는 마지막 취소 generationId.
  cancelledGenerationId: string | null
}

export const initialRecordVoiceAnswerState: RecordVoiceAnswerState = {
  phase: 'idle',
  generationId: null,
  pendingAnswers: [],
  cancelledGenerationId: null,
}

// UI의 RecordVoiceAnswerAction 컴포넌트와 이름이 겹치면 barrel의 `export *`가
// 모호해져 빌드가 깨지므로(TS2308), reducer의 액션 타입은 Event로 구분한다.
export type RecordVoiceAnswerEvent =
  | { type: 'questionGenerationStarted'; generationId: string }
  | { type: 'questionReady'; generationId: string }
  | { type: 'questionPlaybackEnded' }
  | { type: 'voiceCaptured'; answer: CapturedAnswer }

function bufferAnswer(pendingAnswers: CapturedAnswer[], answer: CapturedAnswer): CapturedAnswer[] {
  if (pendingAnswers.some((a) => a.captureId === answer.captureId)) return pendingAnswers
  return [...pendingAnswers, answer]
}

export function reduceRecordVoiceAnswer(
  state: RecordVoiceAnswerState,
  event: RecordVoiceAnswerEvent,
): RecordVoiceAnswerState {
  switch (event.type) {
    case 'questionGenerationStarted':
      // 이 생성 요청이 시작된 시점엔 pendingAnswers가 이미 요청에 실려
      // 나갔다고 보고 비운다(호출자가 pendingAnswers를 실어 보낼 것).
      return { ...state, phase: 'generatingQuestion', generationId: event.generationId, pendingAnswers: [] }

    case 'questionReady':
      if (state.phase !== 'generatingQuestion' || state.generationId !== event.generationId) {
        // 이미 취소됐거나 다른 generation의 결과가 뒤늦게 도착한 경우 — 무시.
        return state
      }
      return { ...state, phase: 'playingQuestion' }

    case 'questionPlaybackEnded':
      if (state.phase !== 'playingQuestion') return state
      return { ...state, phase: 'awaitingAnswer' }

    case 'voiceCaptured':
      if (state.phase === 'generatingQuestion') {
        // 질문 생성 중 음성 수집 → 진행 중인 생성을 취소하고(호출자가
        // questionGenerationCancelled를 보낼 것) idle로 돌아가 이 응답을
        // 포함한 재요청을 준비한다.
        return {
          ...state,
          phase: 'idle',
          cancelledGenerationId: state.generationId,
          generationId: null,
          pendingAnswers: bufferAnswer(state.pendingAnswers, event.answer),
        }
      }
      // 질문 출력 중이든 답변 대기 중이든 출력/흐름은 그대로 유지하고,
      // 응답만 버퍼에 쌓아 다음 질문 생성 요청에 포함시킨다.
      return { ...state, pendingAnswers: bufferAnswer(state.pendingAnswers, event.answer) }

    default:
      return state
  }
}
