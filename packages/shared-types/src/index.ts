// 프론트는 이 패키지를 직접 import하지 않고 apps/frontend/src/shared/types
// 재노출 barrel을 통해 쓴다(FSD 경계 참고).
// 확정된 WebSocket 계약은 ws 하위 모듈에서, REST 과거 대화 조회 계약은
// chat-history에서 관리한다. 예전 turn/컨테이너 기반 모델
// (ConversationTurn/VoiceCapturedEvent 등)은 docs/ws-protocol.md 기준
// 메시지 행 모델로 대체되어 삭제됐다(sprint-plan.md 2026-08-10 업데이트 참고).
export * from './ws'
export * from './chat-history'
