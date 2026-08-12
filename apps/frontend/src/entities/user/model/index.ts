import { createContext, useContext } from 'react'

// Mock session holder — LOGIN_01 (UC-00) has no real backend yet, so this
// context is what stands in for "am I logged in, and as what role" until
// features/login-with-credentials calls a real auth endpoint.
export type Role = 'senior' | 'guardian'

export interface Session {
  userId: string
  name: string
  role: Role
  // /ws/chats 인증 첫 메시지(auth)에 실어 보낼 JWT(docs/ws-protocol.md §5.1).
  // 로그인이 아직 mockResolveRole()이라 실제 토큰을 발급받을 방법이 없으니
  // 지금은 항상 null이다 — apps/backend에 로그인 엔드포인트가 생기면 그
  // 응답의 accessToken으로 채울 것.
  accessToken: string | null
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
