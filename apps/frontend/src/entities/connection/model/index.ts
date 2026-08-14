// SENIOR_LINK_01 / GUARDIAN_LINK_01 (UC-00-1) 기준.
// 보호자-시니어 연결 요청의 상태를 나타내는 도메인 객체 — 어느 한쪽 역할에도
// 속하지 않는 둘 사이의 관계라서 별도 entity로 둠. apps/backend
// ConnectionResponseDto와 1:1로 맞춘다: 활성 관계(REQUESTED/CONNECTED)가 없으면
// 전부 null이고, REJECTED/DISCONNECTED 이력은 GET /connections/me가 아예
// 반환하지 않는다(연결 없음과 동일하게 취급).
export type ConnectionStatus = 'REQUESTED' | 'CONNECTED' | 'REJECTED' | 'DISCONNECTED'

export interface ConnectionCounterpart {
  userId: number
  loginId: string
  name: string
  role: 'SENIOR' | 'GUARDIAN'
}

export interface Connection {
  relationshipId: number | null
  status: ConnectionStatus | null
  requestedAt: string | null
  connectedAt: string | null
  counterpart: ConnectionCounterpart | null
}

export const CONNECTION_QUERY_KEY = ['my-connection'] as const

// 취소/거절/연결 해제는 전부 204(No Content)라 서버가 갱신된 상태를 돌려주지
// 않는다 — 세 액션 모두 결과가 "활성 관계 없음"으로 고정이므로, 호출부는
// invalidateQueries로 재요청을 기다리는 대신 이 값을 캐시에 바로 반영해
// 깜빡임 없이 즉시 빈 상태를 보여줄 수 있다.
export const EMPTY_CONNECTION: Connection = {
  relationshipId: null,
  status: null,
  requestedAt: null,
  connectedAt: null,
  counterpart: null,
}
