import { apiClient, apiFetch } from '../../../shared/api'
import type { ChatMessage, ChatMessageHistoryPage, ChatMessageHistoryQuery } from '../model'

// GET /chats/messages — 시니어 본인의 과거 대화를 cursor 기반으로 조회한다
// (docs/ws-protocol.md §8). seniorId는 JWT에서 서버가 확인하므로 query에
// 포함하지 않고, accessToken은 호출자(페이지/훅)가 세션에서 들고 있는 값을
// 그대로 넘긴다.
export function fetchConversationHistory(
  query: ChatMessageHistoryQuery,
  accessToken: string,
): Promise<ChatMessageHistoryPage> {
  const params = new URLSearchParams()
  if (query.cursor !== undefined) params.set('cursor', String(query.cursor))
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  const queryString = params.toString()

  return apiFetch<ChatMessageHistoryPage>(
    `/chats/messages${queryString ? `?${queryString}` : ''}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )
}

// UC-14(FR-01-09) 시니어 이전 대화 기록 조회 — 특정 날짜의 전체 대화를 시간순으로
// 보여주는 화면이라 cursor 없이 한 번에 가져온다(하루 대화량이 limit을 넘는
// 경우는 향후 무한 스크롤로 확장). Swagger 설명은 "최신순"이라 적혀 있지만
// 실제로는 ChatHistoryRepository.findMessages가 반환 전에 이미 시간순으로
// 뒤집어서 내려준다(레포지토리 자체는 DESC + LIMIT으로 cursor 최신 페이지를
// 얻고 나서 reverse) — 여기서 다시 뒤집으면 이중 반전으로 최신순이 되어버린다.
export async function fetchConversationHistoryByDate(date: string): Promise<ChatMessage[]> {
  const { data } = await apiClient.chats.chatsControllerGetMessages({ date, limit: 100 })
  return data.messages
}

export async function fetchConversationCalendar(year: number, month: number): Promise<Set<string>> {
  const { data } = await apiClient.chats.chatsControllerGetCalendar({ year, month })
  return new Set(data.conversationDates)
}
