import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CONNECTION_QUERY_KEY,
  fetchMyConnection,
  type Connection,
} from '../../../entities/connection'
import { useSession } from '../../../entities/user'
import { StartConversationAction } from '../../../features/start-conversation'
import { ViewAttendanceCalendarAction } from '../../../features/view-attendance-calendar'
import guardianCoupleImage from '../../../shared/assets/illustrations/guardian-couple.png'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './SeniorHomePage.module.css'

interface ConnectionCardCopy {
  label: string
  title: string
  description: string
  action?: string
}

// 홈에서는 연결 관계의 핵심 상태만 요약하고, 수락·거절 같은 실제 조작은
// 연결 요청 화면에서 담당한다. 조회 실패도 연결 없음으로 오해하지 않도록 분리한다.
function connectionCardCopy(
  connection: Connection | undefined,
  isPending: boolean,
  isError: boolean,
): ConnectionCardCopy {
  if (isPending) {
    return {
      label: '보호자 연결',
      title: '연결 상태를 확인하고 있어요',
      description: '잠시만 기다려 주세요.',
    }
  }

  if (isError) {
    return {
      label: '보호자 연결',
      title: '연결 상태를 확인하지 못했어요',
      description: '연결 관리에서 다시 확인해 주세요.',
    }
  }

  if (connection?.status === 'CONNECTED') {
    return {
      label: '연결 완료',
      title: `${connection.counterpart?.name ?? '보호자'}님과 연결되어 있어요`,
      description: '마음잇다가 두 분의 안부를 따뜻하게 이어드릴게요.',
    }
  }

  if (connection?.status === 'REQUESTED') {
    return {
      label: '새로운 요청',
      title: `${connection.counterpart?.name ?? '보호자'}님의 연결 요청이 왔어요`,
      description: '요청을 확인하고 연결 여부를 선택해 주세요.',
    }
  }

  return {
    label: '연결 전',
    title: '아직 연결된 보호자가 없어요',
    description: '보호자가 요청을 보내면 이곳에서 알려드릴게요.',
    action: '연결 정보 보기',
  }
}

// SENIOR_HOME_01 (UC-01, UC-13)
export function SeniorHomePage() {
  const { session } = useSession()
  const connectionQuery = useQuery({ queryKey: CONNECTION_QUERY_KEY, queryFn: fetchMyConnection })
  const connectionCopy = connectionCardCopy(
    connectionQuery.data,
    connectionQuery.isPending,
    connectionQuery.isError,
  )

  return (
    <>
      <main className={styles.page}>
        <section className={styles.content}>
          <header className={styles.greeting}>
            <p className={styles.eyebrow}>마음잇다가 오늘도 함께할게요</p>
            <h1>
              {session?.name} 어르신,
              <span>
                오늘도 좋은 하루 <span className={styles.noBreak}>보내세요! 🌿</span>
              </span>
            </h1>
          </header>

          <StartConversationAction />

          {connectionQuery.data?.status === 'CONNECTED' ? (
            // 이미 연결된 보호자가 있으면 확인·조작할 대기 중인 요청이 없으므로
            // 연결 요청 화면으로 보낼 이유가 없다 — 카드를 눌러도 아무 동작 안 함.
            <div className={styles.connection}>
              <span className={styles.connectionCopy}>
                <span className={styles.connectionLabel}>{connectionCopy.label}</span>
                <strong>{connectionCopy.title}</strong>
                <small>{connectionCopy.description}</small>
              </span>
              <img className={styles.connectionImage} src={guardianCoupleImage} alt="" />
            </div>
          ) : (
            <Link
              className={styles.connection}
              to="/senior/connection"
              aria-label={
                connectionCopy.action
                  ? `${connectionCopy.title}. ${connectionCopy.action}`
                  : connectionCopy.title
              }
            >
              <span className={styles.connectionCopy}>
                <span className={styles.connectionLabel}>{connectionCopy.label}</span>
                <strong>{connectionCopy.title}</strong>
                <small>{connectionCopy.description}</small>
                {connectionCopy.action && (
                  <span className={styles.connectionAction}>
                    {connectionCopy.action} <span aria-hidden="true">›</span>
                  </span>
                )}
              </span>
              <img className={styles.connectionImage} src={guardianCoupleImage} alt="" />
            </Link>
          )}

          <ViewAttendanceCalendarAction />
        </section>
      </main>
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </>
  )
}
