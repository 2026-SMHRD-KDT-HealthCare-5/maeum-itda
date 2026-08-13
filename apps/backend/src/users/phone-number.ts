/*
역할: 화면에서 받은 휴대폰 번호의 구분 문자를 제거해 DB 저장 형식을 숫자로 통일한다.
연결 흐름: 회원가입·내 정보 수정 DTO/Service → normalizePhoneNumber() → USERS.PHONE
*/
export function normalizePhoneNumber(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/-/g, '') : value;
}
