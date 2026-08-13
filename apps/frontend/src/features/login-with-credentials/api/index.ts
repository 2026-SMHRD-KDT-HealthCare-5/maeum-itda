import { apiClient } from '../../../shared/api'
import type { Role } from '../../../entities/user'
import type { LoginFormValues } from '../model'

const ROLE_FROM_API: Record<'SENIOR' | 'GUARDIAN', Role> = {
  SENIOR: 'senior',
  GUARDIAN: 'guardian',
}

export interface LoginResult {
  accessToken: string
  userId: number
  loginId: string
  name: string
  role: Role
}

export async function login(values: LoginFormValues): Promise<LoginResult> {
  const { data } = await apiClient.auth.authControllerLogin({
    loginId: values.id,
    password: values.password,
  })
  return {
    accessToken: data.accessToken,
    userId: data.user.userId,
    loginId: data.user.loginId,
    name: data.user.name,
    role: ROLE_FROM_API[data.user.role],
  }
}
