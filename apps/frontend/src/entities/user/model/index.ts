import { createContext, useContext } from 'react'

// Session holder — LOGIN_01 (UC-00)이 실제 POST /auth/login 응답으로 채운다.
// 새로고침하면 초기화된다(영속화는 아직 없음).
export type Role = 'senior' | 'guardian'

// 백엔드(UserRole enum: 'SENIOR' | 'GUARDIAN')와 프론트 Role 표기를 잇는다.
export function roleFromApi(apiRole: 'SENIOR' | 'GUARDIAN'): Role {
  return apiRole === 'SENIOR' ? 'senior' : 'guardian'
}

export interface Session {
  userId: number
  loginId: string
  name: string
  role: Role
  // /ws/chats 인증 첫 메시지(auth)에 실어 보낼 JWT(docs/ws-protocol.md §5.1)이자
  // REST Authorization: Bearer 헤더에도 쓰는 값 — POST /auth/login 응답의 accessToken.
  accessToken: string
}

// senior-my-info/guardian-my-info가 공유하는 react-query 캐시 키.
export const MY_PROFILE_QUERY_KEY = ['my-profile'] as const

// GET /users/me 응답 — "내 정보" 화면이 표시하는 최신 프로필(전화번호 포함).
// Session은 로그인 시점 값만 들고 있어 phone이 없다 — 최신값은 여기서 조회.
export interface MyProfile {
  userId: number
  loginId: string
  name: string
  phone: string
  role: Role
}

export interface SessionContextValue {
  session: Session | null
  login: (session: Session) => void
  logout: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within a SessionContext provider (see entities/user)')
  }
  return ctx
}
