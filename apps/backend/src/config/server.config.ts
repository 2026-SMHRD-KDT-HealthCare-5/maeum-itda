/*
역할: 로컬과 배포 환경에서 공통으로 사용할 HTTP 포트와 CORS 허용 origin을 해석한다.
전체 흐름: .env/Render 환경변수 → server.config.ts → main.ts → NestJS HTTP·WebSocket 서버
*/

const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

/** Render가 주입한 PORT를 사용하고, 로컬에서는 3000을 기본값으로 사용한다. */
export function resolveServerPort(rawPort?: string): number {
  if (rawPort === undefined || rawPort.trim() === '') {
    return DEFAULT_PORT;
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`유효하지 않은 PORT 환경변수입니다: ${rawPort}`);
  }

  return port;
}

/** 쉼표로 구분한 프론트 origin을 정리하고 중복을 제거한다. */
export function resolveCorsOrigins(rawOrigins?: string): string[] {
  if (rawOrigins === undefined || rawOrigins.trim() === '') {
    return [DEFAULT_CORS_ORIGIN];
  }

  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set(origins)];
}
