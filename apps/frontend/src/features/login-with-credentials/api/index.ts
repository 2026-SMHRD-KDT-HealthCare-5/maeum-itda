import { login as authLogin, type AuthResult } from '../../../entities/user'
import type { LoginFormValues } from '../model'

export async function login(values: LoginFormValues): Promise<AuthResult> {
  return authLogin(values.id, values.password)
}
