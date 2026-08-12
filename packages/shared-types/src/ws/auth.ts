/* 역할: WebSocket 연결 직후 JWT 인증 요청과 결과 계약을 공유한다. */
export interface AuthPayload {
  accessToken: string
}

export interface AuthSuccessPayload {
  userId: number
  role: 'SENIOR'
}

export interface AuthErrorPayload {
  message: string
}
