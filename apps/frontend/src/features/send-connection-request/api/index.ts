// 실제 API 호출(entities/connection의 sendConnectionRequest/cancelConnectionRequest)은
// 여기가 아니라 pages/guardian-connection이 소유한다 — 이 feature의 ui/index.tsx는
// 입력값 표시/전달만 담당하는 순수 프레젠테이션 컴포넌트라 자체 api가 필요 없다.
export {}
