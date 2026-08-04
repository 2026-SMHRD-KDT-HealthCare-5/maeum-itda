// SENIOR_LINK_01 / GUARDIAN_LINK_01 (UC-00-1) 기준.
// 보호자-시니어 연결 요청의 상태를 나타내는 도메인 객체 — 어느 한쪽 역할에도
// 속하지 않는 둘 사이의 관계라서 별도 entity로 둠. 결정사항 로그 §1에서
// MVP 포함으로 확정됨(이전엔 MVP 제외였다가 번복됨).
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'expired'

export interface Connection {
  id: string
  seniorId: string
  guardianId: string
  status: ConnectionStatus
  requestedAt: string
}
