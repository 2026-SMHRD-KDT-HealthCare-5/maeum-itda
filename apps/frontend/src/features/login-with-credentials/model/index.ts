export interface LoginFormValues {
  id: string
  password: string
  autoLogin: boolean
}

// TEMP mock (UC-00 실제 인증 전): 백엔드가 없으니 서버가 반환했을 역할을
// id 값으로 흉내낸다 — id에 'guardian'이 포함되면 보호자, 그 외엔 시니어.
// apps/backend 연동 시 이 함수를 실제 로그인 API 호출로 통째로 교체할 것.
export function mockResolveRole(values: Pick<LoginFormValues, 'id'>): 'senior' | 'guardian' {
  return values.id.toLowerCase().includes('guardian') ? 'guardian' : 'senior'
}
