import { Api } from '@maeum-itda/api-client'
import { API_BASE_URL } from '../config'

// swagger-typescript-api로 apps/backend의 OpenAPI 스펙에서 생성한 타입 있는 REST 클라이언트.
// 재생성: `pnpm --filter @maeum-itda/api-client generate` (백엔드 dev 서버가 떠 있어야 함).
export const apiClient = new Api({ baseUrl: API_BASE_URL })
