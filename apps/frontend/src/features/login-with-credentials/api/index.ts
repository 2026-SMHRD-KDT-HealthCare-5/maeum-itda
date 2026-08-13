import { apiClient } from '../../../shared/api'
import { roleFromApi, type Role } from '../../../entities/user'
import type { LoginFormValues } from '../model'

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
    role: roleFromApi(data.user.role),
  }
}
