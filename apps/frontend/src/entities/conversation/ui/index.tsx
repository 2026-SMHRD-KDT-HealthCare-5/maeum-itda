// TODO(entities/conversation): actual display UI. Placeholder only — see apps/frontend/CLAUDE.md.
// SENIOR_CONVERSATION_01의 "이전 대화 이력 무한 스크롤"(결정사항 로그 §5) 자리.
// 실제 구현 시 TanStack Query의 useInfiniteQuery + entities/conversation/api의
// fetchConversationHistory(계약은 packages/shared-types 참고)로 turn 목록을 그리고,
// 위로 스크롤하면 nextCursor로 과거 페이지를 이어붙일 것. 후속 구현이 챙겨야 할
// 상태: 최초 로딩(isPending), 추가 페이지 로딩(isFetchingNextPage), 빈 이력(turns
// 전체가 0건), 오류(에러 메시지 위치), 마지막 페이지(nextCursor === null이면 더
// 불러올 것 없음을 표시). 실시간 WebSocket으로 들어오는 새 turn과 이 REST 이력을
// id 기준으로 병합·중복 제거하는 처리도 필요하다.
export function ConversationHistoryList() {
  return <div>entities/conversation ConversationHistoryList placeholder</div>
}
