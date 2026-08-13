import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession, type Role } from '../../entities/user'

export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { session, isRestoring } = useSession()
  // localStorage에 남은 accessToken으로 세션을 복원하는 중에는 "로그아웃
  // 상태"로 단정해 /login으로 튕기면 안 된다 — 복원이 끝난 뒤에만 판단한다.
  if (isRestoring) return null
  if (!session || session.role !== role) {
    return <Navigate to="/login" replace />
  }
  return children
}
