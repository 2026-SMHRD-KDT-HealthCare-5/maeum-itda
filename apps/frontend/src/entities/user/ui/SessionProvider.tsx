import { useMemo, useState, type ReactNode } from 'react'
import { SessionContext, type Session } from '../model'

// Wraps the app so any layer can read "who is logged in" via useSession().
// State is in-memory only (lost on refresh) until real auth (UC-00) exists.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)

  const value = useMemo(
    () => ({
      session,
      login: (next: Session) => setSession(next),
      logout: () => setSession(null),
    }),
    [session],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}
