// SENIOR_LINK_01 / GUARDIAN_LINK_01 (UC-00-1) 기준.
// 보호자-시니어 연결 요청의 상태를 나타내는 도메인 객체 — 어느 한쪽 역할에도
// 속하지 않는 둘 사이의 관계라서 별도 entity로 둠. 결정사항 로그 §1에서
// MVP 포함으로 확정됨(이전엔 MVP 제외였다가 번복됨).
// 'disconnected'는 결정사항 로그 §7 — 시니어/보호자 내 정보 화면의
// "연결 끊기" 액션(features/disconnect-connection)이 만드는 상태.
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'disconnected'

export interface Connection {
  id: string
  seniorId: string
  guardianId: string
  status: ConnectionStatus
  requestedAt: string
  // status가 'accepted'로 바뀐 시각 — 연결 유지 기간("N일째") 표기에 필요.
  connectedAt: string | null
}
