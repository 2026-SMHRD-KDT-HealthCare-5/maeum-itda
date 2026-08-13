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
