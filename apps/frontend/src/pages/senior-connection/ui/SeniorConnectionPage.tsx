import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { RespondConnectionRequestAction } from '../../../features/respond-connection-request'
import {
  CONNECTION_QUERY_KEY,
  EMPTY_CONNECTION,
  fetchMyConnection,
  acceptConnectionRequest,
  rejectConnectionRequest,
} from '../../../entities/connection'
import { extractApiErrorMessage } from '../../../shared/api'
import { useDelayedPending } from '../../../shared/lib'
import { Button, LoadingSpinner } from '../../../shared/ui'
import styles from './SeniorConnectionPage.module.css'

// SENIOR_LINK_01 (UC-00-1) — 받은 연결 요청(GET /connections/me의 status가
// 'REQUESTED')이 있으면 수락/거절 화면을, 없으면 빈 상태를 보여준다.
export function SeniorConnectionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const connectionQuery = useQuery({
    queryKey: CONNECTION_QUERY_KEY,
    queryFn: fetchMyConnection,
  })

  const acceptMutation = useMutation({
    mutationFn: (relationshipId: number) => acceptConnectionRequest(relationshipId),
    onSuccess: (connection) => {
      queryClient.setQueryData(CONNECTION_QUERY_KEY, connection)
      navigate('/senior')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (relationshipId: number) => rejectConnectionRequest(relationshipId),
    onSuccess: () => {
      queryClient.setQueryData(CONNECTION_QUERY_KEY, EMPTY_CONNECTION)
      navigate('/senior')
    },
  })

  const connection = connectionQuery.data
  const relationshipId = connection?.relationshipId ?? null
  const showConnectionSpinner = useDelayedPending(connectionQuery.isPending)

  return (
    <main className={styles.overlay} aria-label="보호자 연결 요청">
      <button
        type="button"
        className={styles.backButton}
        onClick={() => navigate('/senior')}
        aria-label="홈으로 돌아가기"
      >
        ‹
      </button>

      {showConnectionSpinner && <LoadingSpinner overlay label="연결 요청을 확인하는 중이에요" />}

      {!showConnectionSpinner && connectionQuery.isError && (
        <div className={styles.statusMessage} role="alert">
          <p>연결 요청을 불러오지 못했어요.</p>
          <Button type="button" onClick={() => connectionQuery.refetch()}>
            다시 시도
          </Button>
        </div>
      )}

      {!showConnectionSpinner &&
        (connection?.status === 'REQUESTED' && relationshipId != null ? (
          <RespondConnectionRequestAction
            guardianName={connection.counterpart?.name ?? '보호자'}
            onAccept={() => acceptMutation.mutate(relationshipId)}
            onReject={() => rejectMutation.mutate(relationshipId)}
            isAccepting={acceptMutation.isPending}
            isRejecting={rejectMutation.isPending}
            error={
              acceptMutation.isError
                ? extractApiErrorMessage(acceptMutation.error, '요청 수락에 실패했어요.')
                : rejectMutation.isError
                  ? extractApiErrorMessage(rejectMutation.error, '요청 거절에 실패했어요.')
                  : null
            }
          />
        ) : (
          connectionQuery.isSuccess && (
            <p className={styles.statusMessage}>받은 연결 요청이 없어요.</p>
          )
        ))}
    </main>
  )
}
