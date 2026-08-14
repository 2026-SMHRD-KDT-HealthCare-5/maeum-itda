import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiClient } from '../../../shared/api'
import { fetchMyProfile } from '../api'
import { SessionContext, MY_PROFILE_QUERY_KEY, type Session } from '../model'

const ACCESS_TOKEN_STORAGE_KEY = 'maeum-itda:accessToken'

// Wraps the app so any layer can read "who is logged in" via useSession().
// "자동 로그인"으로 남겨둔 accessToken이 있으면 마운트 시 GET /users/me로
// 검증해 세션을 복원한다 — 없거나 만료됐으면 그대로 로그아웃 상태로 둔다.
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isRestoring, setIsRestoring] = useState(
    () => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) !== null,
  )

  useEffect(() => {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
    if (!storedToken) return

    apiClient.setSecurityData(storedToken)
    fetchMyProfile()
      .then((profile) => {
        // 세션 복원 때 이미 GET /users/me를 호출했으니, 페이지가 같은 키로 다시
        // useQuery를 걸 때 중복 fetch(그리고 중복 로딩 오버레이) 없이 이 결과를
        // 그대로 쓰도록 캐시에 심어둔다.
        queryClient.setQueryData(MY_PROFILE_QUERY_KEY, profile)
        setSession({
          userId: profile.userId,
          loginId: profile.loginId,
          name: profile.name,
          role: profile.role,
          accessToken: storedToken,
        })
      })
      .catch((error: unknown) => {
        apiClient.setSecurityData(null)
        // 만료/무효 토큰(401)일 때만 지운다 — 일시적 네트워크 오류라면 다음
        // 새로고침에서 다시 시도할 수 있게 남겨둔다.
        if ((error as { status?: number }).status === 401) {
          localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
        }
      })
      .finally(() => setIsRestoring(false))
  }, [queryClient])

  const value = useMemo(
    () => ({
      session,
      isRestoring,
      login: (next: Session, options?: { remember?: boolean }) => {
        // apiClient의 @secure 요청(GET/PATCH /users/me 등)에 Authorization
        // 헤더를 자동으로 실어주기 위해 securityData를 함께 채운다.
        apiClient.setSecurityData(next.accessToken)
        if (options?.remember) {
          localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, next.accessToken)
        } else {
          localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
        }
        setSession(next)
      },
      logout: () => {
        apiClient.setSecurityData(null)
        localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
        setSession(null)
      },
    }),
    [session, isRestoring],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}
