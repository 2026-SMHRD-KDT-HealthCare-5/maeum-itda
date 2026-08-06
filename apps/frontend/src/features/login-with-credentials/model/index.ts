export interface LoginFormValues {
  id: string
  password: string
  autoLogin: boolean
}

export interface LoginFormErrors {
  id?: string
  password?: string
}

// 로그인 화면 목업의 입력창 Error 상태(B/C) 기준 — 필수 입력 검증만.
// "아이디 또는 비밀번호가 일치하지 않습니다" 실패 토스트(G)는 실제 인증
// 결과가 있어야 판단 가능하므로 apps/backend 로그인 엔드포인트 연동 시 추가.
export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {}
  if (!values.id.trim()) errors.id = '아이디를 입력해주세요.'
  if (!values.password) errors.password = '비밀번호를 입력해주세요.'
  return errors
}

// TEMP mock (UC-00 실제 인증 전): 백엔드가 없으니 서버가 반환했을 역할을
// id 값으로 흉내낸다 — id에 'guardian'이 포함되면 보호자, 그 외엔 시니어.
// apps/backend 연동 시 이 함수를 실제 로그인 API 호출로 통째로 교체할 것.
export function mockResolveRole(values: Pick<LoginFormValues, 'id'>): 'senior' | 'guardian' {
  return values.id.toLowerCase().includes('guardian') ? 'guardian' : 'senior'
}
