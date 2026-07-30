import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession, type Role } from '../../entities/user'

export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { session } = useSession()
  if (!session || session.role !== role) {
    return <Navigate to="/login" replace />
  }
  return children
}
