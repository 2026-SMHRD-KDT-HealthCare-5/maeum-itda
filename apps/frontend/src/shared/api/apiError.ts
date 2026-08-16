// apiClient가 실패 시 던지는 값에서 사용자에게 보여줄 메시지 한 줄을 뽑아낸다.
// 두 가지 실패 유형을 구분한다:
// 1) 서버가 JSON 에러 응답을 준 경우 — apiClient가 HttpResponse(error: ApiErrorResponseDto)를 던짐
// 2) 요청 자체가 서버에 도달하지 못한 경우(CORS 차단, 오프라인 등) — 브라우저 fetch가 TypeError를 던짐,
//    이땐 .error 필드가 없으므로 별도 안내 문구로 구분한다.
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError) {
    return '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.'
  }

  if (error && typeof error === 'object' && 'error' in error) {
    const apiError = (error as { error?: { message?: string | string[] } }).error
    const message = apiError?.message
    if (Array.isArray(message)) return message[0] ?? fallback
    if (typeof message === 'string') return message
  }

  return fallback
}

// apiClient가 던지는 HttpResponse는 Response를 상속해 status를 그대로 갖고 있다 —
// "해당 날짜/주에 리포트가 아직 없음"처럼 404가 곧 정상적인 빈 상태인 화면에서
// 에러 배너 대신 빈 상태를 보여줄지 구분하는 데 쓴다.
export function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 404)
}
