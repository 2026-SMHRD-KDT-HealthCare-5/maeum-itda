import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DisconnectConnectionAction } from '../../../features/disconnect-connection'
import { EditBasicInfoAction } from '../../../features/edit-basic-info'
import {
  SetNotificationThresholdAction,
  type NotificationThresholdValue,
} from '../../../features/set-notification-threshold'
import { formatConnectionDuration, type Connection } from '../../../entities/connection'
import { Button, Card } from '../../../shared/ui'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { useSession } from '../../../entities/user'
import styles from './MyInfoPage.module.css'

// 결정사항 로그 §7 — Figma '보호자 내 정보' 화면 최초 반영. 기존 별도
// 화면이던 UC-12(알림 설정)를 여기로 흡수했다. 실제 API 연결 전이라
// 시니어/보호자/연결 데이터는 페이지 로컬 mock 상태로 둔다.
const mockSeniorName = '김순자'

export function GuardianMyInfoPage() {
  const { session, logout } = useSession()
  const navigate = useNavigate()

  const [basicInfo, setBasicInfo] = useState({
    username: session?.loginId ?? 'guardian01',
    name: session?.name ?? '김민준',
    phone: '010-9876-5432',
  })
  const [connection, setConnection] = useState<Connection>({
    id: 'conn-1',
    seniorId: 'senior-1',
    guardianId: 'guardian-1',
    status: 'accepted',
    requestedAt: '2025-03-01T00:00:00.000Z',
    connectedAt: '2025-03-01T00:00:00.000Z',
  })
  const [notificationThreshold, setNotificationThreshold] = useState<NotificationThresholdValue>({
    enabled: true,
    threshold: 50,
  })

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isConnected = connection.status === 'accepted'

  return (
    <>
      <main className={styles.page}>
        <header className={styles.header}>
          <span className={styles.avatar} aria-hidden="true">
            🧑
          </span>
          <h1 className={styles.name}>{basicInfo.name} 보호자</h1>
        </header>

        <div className={styles.cards}>
          <Card>
            <EditBasicInfoAction
              values={basicInfo}
              onSave={(next) => setBasicInfo((current) => ({ ...current, ...next }))}
            />
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>연결된 어르신</h2>
            {isConnected ? (
              <div className={styles.connectedRow}>
                <div className={styles.connectedInfo}>
                  <span className={styles.connectedAvatar} aria-hidden="true">
                    👵
                  </span>
                  <div>
                    <p className={styles.connectedName}>{mockSeniorName}</p>
                    <p className={styles.connectedMeta}>
                      {formatConnectionDuration(connection.connectedAt)}
                    </p>
                  </div>
                </div>
                <DisconnectConnectionAction
                  onDisconnect={() =>
                    setConnection((current) => ({ ...current, status: 'disconnected' }))
                  }
                />
              </div>
            ) : (
              <div className={styles.emptyConnection}>
                <p className={styles.emptyConnectionText}>연결된 어르신이 없어요</p>
                <Link to="/guardian/connection">
                  <Button type="button" variant="outline">
                    연결하기
                  </Button>
                </Link>
              </div>
            )}
          </Card>

          <Card>
            <SetNotificationThresholdAction
              value={notificationThreshold}
              onChange={setNotificationThreshold}
            />
          </Card>

          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </main>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </>
  )
}
