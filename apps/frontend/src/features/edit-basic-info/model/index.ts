export interface BasicInfoValues {
  username: string
  name: string
  phone: string
}

export type BasicInfoErrors = Partial<Record<'name' | 'phone', string>>

const phonePattern = /^01[016789]\d{7,8}$/

// register-account의 검증 규칙과 동일한 휴대폰 형식을 재사용한다.
export function validateBasicInfo(
  values: Pick<BasicInfoValues, 'name' | 'phone'>,
): BasicInfoErrors {
  const errors: BasicInfoErrors = {}

  if (!values.name.trim()) errors.name = '이름을 입력해주세요.'

  const phoneDigits = values.phone.replace(/\D/g, '')
  if (!phoneDigits) {
    errors.phone = '휴대폰 번호를 입력해주세요.'
  } else if (!phonePattern.test(phoneDigits)) {
    errors.phone = '올바른 휴대폰 번호를 입력해주세요.'
  }

  return errors
}

// features/register-account에도 동일한 헬퍼가 있지만, FSD 규칙상 같은 레이어의
// 다른 feature를 옆으로 import할 수 없어 여기 따로 둔다.
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}
