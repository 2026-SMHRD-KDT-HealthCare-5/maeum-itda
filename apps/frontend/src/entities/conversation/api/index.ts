import { apiFetch } from '../../../shared/api'
import type { ChatMessageHistoryPage, ChatMessageHistoryQuery } from '../model'

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
