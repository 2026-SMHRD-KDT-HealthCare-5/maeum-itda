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
// "아이디 또는 비밀번호가 일치하지 않습니다"는 실제 로그인 API 응답 실패
// 시(features/login-with-credentials/api) 보여주는 별도 안내 문구다.
export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {}
  if (!values.id.trim()) errors.id = '아이디를 입력해주세요.'
  if (!values.password) errors.password = '비밀번호를 입력해주세요.'
  return errors
}
