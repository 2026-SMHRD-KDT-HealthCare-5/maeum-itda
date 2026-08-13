import { createContext, useContext } from 'react'

// Session holder — LOGIN_01 (UC-00)이 실제 POST /auth/login 응답으로 채운다.
// 새로고침하면 초기화된다(영속화는 아직 없음).
export type Role = 'senior' | 'guardian'

export interface Session {
  userId: number
  loginId: string
  name: string
  role: Role
  // /ws/chats 인증 첫 메시지(auth)에 실어 보낼 JWT(docs/ws-protocol.md §5.1)이자
  // REST Authorization: Bearer 헤더에도 쓰는 값 — POST /auth/login 응답의 accessToken.
  accessToken: string
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
