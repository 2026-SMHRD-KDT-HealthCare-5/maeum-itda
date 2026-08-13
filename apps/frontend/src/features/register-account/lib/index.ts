// apiClient가 실패 응답에서 던지는 HttpResponse(error: ApiErrorResponseDto)로부터
// 사용자에게 보여줄 메시지 한 줄을 뽑아낸다.
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const apiError = (error as { error?: { message?: string | string[] } }).error
    const message = apiError?.message
    if (Array.isArray(message)) return message[0] ?? fallback
    if (typeof message === 'string') return message
  }
  return fallback
}
