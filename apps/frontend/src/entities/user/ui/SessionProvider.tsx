import { useMemo, useState, type ReactNode } from 'react'
import { apiClient } from '../../../shared/api'
import { SessionContext, type Session } from '../model'

// Wraps the app so any layer can read "who is logged in" via useSession().
// State is in-memory only (lost on refresh) — 아직 localStorage 등 영속화 없음.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)

  const value = useMemo(
    () => ({
      session,
      login: (next: Session) => {
        // apiClient의 @secure 요청(GET/PATCH /users/me 등)에 Authorization
        // 헤더를 자동으로 실어주기 위해 securityData를 함께 채운다.
        apiClient.setSecurityData(next.accessToken)
        setSession(next)
      },
      logout: () => {
        apiClient.setSecurityData(null)
        setSession(null)
      },
    }),
    [session],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}
