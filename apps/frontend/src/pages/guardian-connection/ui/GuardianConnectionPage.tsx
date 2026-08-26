import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { SendConnectionRequestAction } from '../../../features/send-connection-request'
import {
  CONNECTION_QUERY_KEY,
  EMPTY_CONNECTION,
  fetchMyConnection,
  sendConnectionRequest,
  cancelConnectionRequest,
} from '../../../entities/connection'
import { extractApiErrorMessage } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { ErrorState, LoadingSpinner } from '../../../shared/ui'
import styles from './GuardianConnectionPage.module.css'

// GUARDIAN_LINK_01 (UC-00-1) — 내 정보의 미연결 상태에서 진입하는
// 전용 연결 요청 화면. 요청 폼 UI는 feature가 담당하고, 실제 서버 상태(GET
// /connections/me)와 요청/취소 mutation은 이 페이지가 소유한다.
export function GuardianConnectionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  // 홈/내 정보 어느 쪽에서 들어왔는지 호출부가 state로 넘겨준다 — 푸시
  // 알림 클릭처럼 이력 없이 바로 진입한 경우엔 내 정보로 돌아간다.
  const backTo = (location.state as { from?: string } | null)?.from ?? '/guardian/my-info'

  const connectionQuery = useQuery({
    queryKey: CONNECTION_QUERY_KEY,
    queryFn: fetchMyConnection,
  })

  const sendMutation = useMutation({
    mutationFn: sendConnectionRequest,
    onSuccess: (connection) => queryClient.setQueryData(CONNECTION_QUERY_KEY, connection),
  })

  const cancelMutation = useMutation({
    mutationFn: (relationshipId: number) => cancelConnectionRequest(relationshipId),
    onSuccess: () => queryClient.setQueryData(CONNECTION_QUERY_KEY, EMPTY_CONNECTION),
  })

  const showConnectionSpinner = useDelayedPending(connectionQuery.isPending)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate(backTo)}
          aria-label="뒤로 가기"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m14.5 6-6 6 6 6" />
          </svg>
        </button>
        <h1 className={styles.title}>시니어 연결</h1>
      </header>

      <section className={styles.intro} aria-labelledby="connection-heading">
        <p className={styles.eyebrow}>어르신과 마음잇기</p>
        <h2 id="connection-heading">돌보실 어르신을 연결해 주세요</h2>
        <p className={styles.description}>
          한 분의 어르신과만 연결할 수 있어요. 요청을 수락하시면 정서 리포트를 받아볼 수 있어요.
        </p>
      </section>

      <ol className={styles.steps} aria-label="어르신 연결 순서">
        <li>
          <span>1</span>
          <p>아이디 입력</p>
        </li>
        <li>
          <span>2</span>
          <p>어르신 수락</p>
        </li>
        <li>
          <span>3</span>
          <p>연결 완료</p>
        </li>
      </ol>

      {showConnectionSpinner && <LoadingSpinner overlay label="연결 상태를 확인하는 중이에요" />}

      {!showConnectionSpinner && connectionQuery.isError && (
        <ErrorState
          message="연결 상태를 불러오지 못했어요."
          onRetry={() => void connectionQuery.refetch()}
          isRetrying={connectionQuery.isFetching}
        />
      )}

      {!showConnectionSpinner && connectionQuery.data?.status === 'CONNECTED' && (
        <p className={styles.statusMessage}>이미 어르신과 연결되어 있어요.</p>
      )}

      {!showConnectionSpinner &&
        connectionQuery.data &&
        connectionQuery.data.status !== 'CONNECTED' && (
          <SendConnectionRequestAction
            pendingRequest={
              connectionQuery.data.status === 'REQUESTED' && connectionQuery.data.counterpart
                ? {
                    seniorName: connectionQuery.data.counterpart.name,
                    requestedAt: connectionQuery.data.requestedAt ?? new Date().toISOString(),
                  }
                : null
            }
            onSubmit={(seniorLoginId) => sendMutation.mutate(seniorLoginId)}
            onCancel={() => {
              const relationshipId = connectionQuery.data?.relationshipId
              if (relationshipId != null) cancelMutation.mutate(relationshipId)
            }}
            isSubmitting={sendMutation.isPending}
            isCancelling={cancelMutation.isPending}
            error={
              sendMutation.isError
                ? extractApiErrorMessage(sendMutation.error, '연결 요청에 실패했어요.')
                : null
            }
          />
        )}
    </main>
  )
}
