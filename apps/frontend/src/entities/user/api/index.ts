import { apiClient } from '../../../shared/api'
import { roleFromApi, type AuthResult, type MyProfile } from '../model'

// login-with-credentials(로그인 폼)와 register-account(가입 즉시 로그인)가
// 공유하는 실제 인증 호출 — entities 레이어에 둬서 두 feature가 서로 옆으로
// import하지 않고도 같은 로그인 로직을 쓸 수 있게 한다.
export async function login(loginId: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.auth.authControllerLogin({ loginId, password })
  return {
    accessToken: data.accessToken,
    userId: data.user.userId,
    loginId: data.user.loginId,
    name: data.user.name,
    role: roleFromApi(data.user.role),
  }
}

export async function fetchMyProfile(): Promise<MyProfile> {
  const { data } = await apiClient.users.usersControllerGetMyProfile()
  return {
    userId: data.userId,
    loginId: data.loginId,
    name: data.name,
    phone: data.phone,
    role: roleFromApi(data.role),
  }
}
