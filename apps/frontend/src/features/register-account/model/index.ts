export type RegisterRole = 'senior' | 'guardian'

export interface RegisterAccountValues {
  role: RegisterRole | null
  username: string
  password: string
  passwordConfirm: string
  name: string
  phone: string
}

export type RegisterAccountField = keyof RegisterAccountValues
export type RegisterAccountErrors = Partial<Record<RegisterAccountField, string>>

const usernamePattern = /^[a-zA-Z0-9]{4,20}$/
const phonePattern = /^01[016789]\d{7,8}$/

export function validateRegisterAccount(values: RegisterAccountValues): RegisterAccountErrors {
  const errors: RegisterAccountErrors = {}

  if (!values.role) errors.role = '가입할 역할을 선택해주세요.'

  if (!values.username.trim()) {
    errors.username = '아이디를 입력해주세요.'
  } else if (!usernamePattern.test(values.username.trim())) {
    errors.username = '영문과 숫자만 사용해 4~20자로 입력해주세요.'
  }

  if (!values.password) {
    errors.password = '비밀번호를 입력해주세요.'
  } else if (values.password.length < 4) {
    errors.password = '비밀번호는 4자 이상이어야 합니다.'
  }

  if (!values.passwordConfirm) {
    errors.passwordConfirm = '비밀번호를 한 번 더 입력해주세요.'
  } else if (values.password !== values.passwordConfirm) {
    errors.passwordConfirm = '비밀번호가 일치하지 않아요.'
  }

  if (!values.name.trim()) errors.name = '이름을 입력해주세요.'

  const phoneDigits = values.phone.replace(/\D/g, '')
  if (!phoneDigits) {
    errors.phone = '휴대폰 번호를 입력해주세요.'
  } else if (!phonePattern.test(phoneDigits)) {
    errors.phone = '올바른 휴대폰 번호를 입력해주세요.'
  }

  return errors
}

export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}
