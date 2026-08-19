import { resolveCorsOrigins, resolveServerPort } from './server.config';

describe('server config', () => {
  describe('resolveServerPort', () => {
    it('환경변수가 없으면 로컬 기본 포트 3000을 반환한다', () => {
      expect(resolveServerPort()).toBe(3000);
    });

    it('Render가 전달한 포트를 숫자로 변환한다', () => {
      expect(resolveServerPort('10000')).toBe(10000);
    });

    it('유효하지 않은 포트는 서버 시작 전에 거부한다', () => {
      expect(() => resolveServerPort('not-a-port')).toThrow(
        '유효하지 않은 PORT 환경변수입니다',
      );
    });
  });

  describe('resolveCorsOrigins', () => {
    it('환경변수가 없으면 로컬 Vite 주소를 허용한다', () => {
      expect(resolveCorsOrigins()).toEqual(['http://localhost:5173']);
    });

    it('쉼표로 구분한 origin을 정리하고 중복을 제거한다', () => {
      expect(
        resolveCorsOrigins(
          'https://app.example.com, https://dev.example.com,https://app.example.com',
        ),
      ).toEqual(['https://app.example.com', 'https://dev.example.com']);
    });
  });
});
