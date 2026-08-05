// SENIOR_CONVERSATION_01 (UC-01/02/03) 기준.
// 결정사항 로그(§5, 2026-08-05)에 따라 "대화(conversation)" 컨테이너 개념은
// 없다 — turn 하나하나가 자신의 createdAt을 갖는 독립적인 이력 레코드이며,
// 시니어 안부 대화 화면은 이 turn들을 무한 스크롤로 이어서 보여준다.
// 실제 타입은 packages/shared-types에 고정되어 있다(mobile-portability
// guideline 참고) — 여기서는 그걸 그대로 재노출한다.
export type { ConversationTurn } from '@maeum-itda/shared-types'
