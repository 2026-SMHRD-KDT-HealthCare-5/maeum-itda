import type { QuestionTurnPhase } from '@maeum-itda/shared-types'

// 결정사항 로그 §5(응답 유실 방지)를 그대로 옮긴 순수 상태 전이 함수 —
// 실제 WebSocket 연동(effect) 없이도 단위 테스트 가능. UI/네트워크 연동은
// 아직 TODO(UC-02)이며, 이 reducer가 그 연동이 따라야 할 상태 규칙이다.
export type RecordVoiceAnswerState =
  | { phase: 'idle' }
  | { phase: QuestionTurnPhase; generationId: string }

export type RecordVoiceAnswerAction =
  | { type: 'questionGenerationStarted'; generationId: string }
  | { type: 'questionReady'; generationId: string }
  | { type: 'questionPlaybackEnded' }
  | { type: 'voiceCaptured' }

export function reduceRecordVoiceAnswer(
  state: RecordVoiceAnswerState,
  action: RecordVoiceAnswerAction,
): RecordVoiceAnswerState {
  switch (action.type) {
    case 'questionGenerationStarted':
      return { phase: 'generatingQuestion', generationId: action.generationId }

    case 'questionReady':
      if (state.phase !== 'generatingQuestion' || state.generationId !== action.generationId) {
        // 이미 취소된 generationId의 결과가 뒤늦게 도착한 경우 — 무시.
        return state
      }
      return { phase: 'playingQuestion', generationId: action.generationId }

    case 'questionPlaybackEnded':
      if (state.phase !== 'playingQuestion') return state
      return { phase: 'awaitingAnswer', generationId: state.generationId }

    case 'voiceCaptured':
      if (state.phase === 'generatingQuestion') {
        // 질문 생성 중 음성 수집 → 진행 중인 생성을 취소하고(호출자가
        // questionGenerationCancelled를 보낼 것) idle로 돌아가 이 응답을
        // 포함한 재요청을 준비한다.
        return { phase: 'idle' }
      }
      if (state.phase === 'playingQuestion') {
        // 질문 출력 중 음성 수집 → 출력은 그대로 유지, 수집된 응답은
        // 호출자가 버퍼링해 다음 질문 생성 요청에 포함한다.
        return state
      }
      return state

    default:
      return state
  }
}
