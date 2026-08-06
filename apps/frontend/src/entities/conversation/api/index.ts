// TODO(entities/conversation): fetch/mutate calls for this entity, via shared/api. Not implemented yet.
// apps/backend 연동 시 아래 시그니처로 구현할 것(계약은 packages/shared-types의
// ConversationHistoryQuery/ConversationHistoryPage 참고) — SENIOR_CONVERSATION_01의
// 무한 스크롤 이력 조회에서 useInfiniteQuery의 queryFn으로 바로 쓰기 위한 모양이다:
//   export function fetchConversationHistory(
//     query: ConversationHistoryQuery,
//   ): Promise<ConversationHistoryPage>
export {}
