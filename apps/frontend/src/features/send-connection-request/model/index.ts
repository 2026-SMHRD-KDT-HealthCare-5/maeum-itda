// 보호자가 보낸, 아직 시니어가 응답하지 않은 연결 요청 — GET /connections/me의
// status가 'REQUESTED'일 때 페이지가 이 모양으로 만들어 넘겨준다.
export interface PendingSentRequest {
  seniorName: string
  requestedAt: string
}
