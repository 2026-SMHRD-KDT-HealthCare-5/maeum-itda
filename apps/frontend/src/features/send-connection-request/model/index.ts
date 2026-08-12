export interface SentConnectionRequest {
  seniorUsername: string
  requestedAt: string
}

// TEMP mock (UC-00-1 실제 연결 요청 API 연동 전): 'notfound'를 입력하면
// 존재하지 않는 아이디로 취급하고, 그 외 값은 전부 성공으로 처리한다.
// apps/backend 연동 시 이 함수를 실제 API 호출로 교체할 것.
export function mockSendConnectionRequest(seniorUsername: string): { ok: boolean } {
  return { ok: seniorUsername.trim().toLowerCase() !== 'notfound' }
}
