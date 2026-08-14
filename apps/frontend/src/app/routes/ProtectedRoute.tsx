import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession, type Role } from '../../entities/user'
import { useDelayedPending } from '../../shared/lib'
import { LoadingSpinner } from '../../shared/ui'

export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { session, isRestoring } = useSession()
  const showRestoringSpinner = useDelayedPending(isRestoring)
  // localStorage에 남은 accessToken으로 세션을 복원하는 중에는 "로그아웃
  // 상태"로 단정해 /login으로 튕기면 안 된다 — 복원이 끝난 뒤에만 판단한다.
  // isRestoring은 거의 항상 즉시 끝나서(localStorage 동기 읽기) showRestoringSpinner는
  // 대부분 true가 안 되지만, hold 중엔 이 분기에 계속 머물러야 한다.
  if (isRestoring || showRestoringSpinner) {
    return showRestoringSpinner ? <LoadingSpinner overlay /> : null
  }
  if (!session || session.role !== role) {
    return <Navigate to="/login" replace />
  }
  return children
}
