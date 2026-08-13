import { Api } from '@maeum-itda/api-client'
import { API_BASE_URL } from '../config'

// swagger-typescript-api로 apps/backend의 OpenAPI 스펙에서 생성한 타입 있는 REST 클라이언트.
// 재생성: `pnpm --filter @maeum-itda/api-client generate` (백엔드 dev 서버가 떠 있어야 함).
// securityData는 entities/user의 SessionProvider가 로그인/로그아웃 시
// setSecurityData()로 채우거나 비운다 — @secure 표시가 있는(=JWT 인증 필요한)
// 요청에만 자동으로 Authorization 헤더가 붙는다.
export const apiClient = new Api<string | null>({
  baseUrl: API_BASE_URL,
  securityWorker: (accessToken) =>
    accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
})
