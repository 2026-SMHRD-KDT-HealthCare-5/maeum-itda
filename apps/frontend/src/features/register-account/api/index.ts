import { apiClient } from '../../../shared/api'
import type { RegisterAccountValues, RegisterRole } from '../model'

const ROLE_TO_API: Record<RegisterRole, 'SENIOR' | 'GUARDIAN'> = {
  senior: 'SENIOR',
  guardian: 'GUARDIAN',
}

export async function checkLoginIdAvailable(loginId: string) {
  const { data } = await apiClient.auth.authControllerCheckLoginId({ loginId })
  return data
}

export async function registerAccount(values: RegisterAccountValues) {
  if (!values.role) throw new Error('가입할 역할을 선택해주세요.')

  // Figma 목업(screen-join.png)에 별도 약관 동의 체크박스가 없음 — 로그인 화면 하단
  // 문구와 동일하게 가입 버튼 클릭 자체를 약관 동의로 처리한다.
  const { data } = await apiClient.auth.authControllerSignUp({
    loginId: values.username,
    password: values.password,
    passwordConfirm: values.passwordConfirm,
    name: values.name,
    phone: values.phone.replace(/\D/g, ''),
    role: ROLE_TO_API[values.role],
    termsAgreed: true,
  })
  return data
}
