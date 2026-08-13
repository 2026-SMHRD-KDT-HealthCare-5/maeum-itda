/* 역할: 휴대폰 번호 표시 구분자를 제거하는 공통 정규화 규칙을 검증한다. */
import { normalizePhoneNumber } from './phone-number';

describe('normalizePhoneNumber', () => {
  it.each([
    ['010-1234-5678', '01012345678'],
    ['01012345678', '01012345678'],
  ])('%s를 숫자 저장 형식으로 바꾼다', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });
});
