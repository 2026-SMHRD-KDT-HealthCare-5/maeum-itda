import { createContext, useContext } from 'react'

// Mock session holder — LOGIN_01 (UC-00) has no real backend yet, so this
// context is what stands in for "am I logged in, and as what role" until
// features/login-with-credentials calls a real auth endpoint.
export type Role = 'senior' | 'guardian'

export interface Session {
  userId: string
  name: string
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
