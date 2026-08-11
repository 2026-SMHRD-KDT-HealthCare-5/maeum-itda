import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DisconnectConnectionAction } from '../../../features/disconnect-connection'
import { EditBasicInfoAction } from '../../../features/edit-basic-info'
import {
  SetCheckinReminderAction,
  type CheckinReminderValue,
} from '../../../features/set-checkin-reminder'
import { formatConnectionDuration, type Connection } from '../../../entities/connection'
import { Button, Card } from '../../../shared/ui'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import { useSession } from '../../../entities/user'
import guardianCoupleImage from '../../../shared/assets/illustrations/guardian-couple.png'
import seniorCoupleImage from '../../../shared/assets/illustrations/senior-couple.png'
import styles from './MyInfoPage.module.css'

// 결정사항 로그 §7 — Figma '시니어 내 정보' 화면 최초 반영. 실제 API 연결
// 전이라 시니어/보호자/연결 데이터는 페이지 로컬 mock 상태로 둔다
// (다른 placeholder 화면의 ConversationHistoryList 등과 동일한 수준).
const mockGuardianName = '홍길동'

export function SeniorMyInfoPage() {
  const { session, logout } = useSession()
  const navigate = useNavigate()

  const [basicInfo, setBasicInfo] = useState({
    username: session?.userId ?? 'senior01',
    name: session?.name ?? '김순자',
    phone: '010-1234-5678',
  })
  const [connection, setConnection] = useState<Connection>({
    id: 'conn-1',
    seniorId: 'senior-1',
    guardianId: 'guardian-1',
    status: 'accepted',
    requestedAt: '2025-03-01T00:00:00.000Z',
    connectedAt: '2025-03-01T00:00:00.000Z',
  })
  const [checkinReminder, setCheckinReminder] = useState<CheckinReminderValue>({
    enabled: true,
    time: '09:00',
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
          <h1>내 정보</h1>
          <span className={styles.avatar} aria-hidden="true">
            <img src={seniorCoupleImage} alt="" />
          </span>
          <p className={styles.name}>{basicInfo.name} 어르신</p>
        </header>

        <div className={styles.cards}>
          <Card>
            <EditBasicInfoAction
              values={basicInfo}
              onSave={(next) => setBasicInfo((current) => ({ ...current, ...next }))}
            />
          </Card>

          <Card>
            <h2 className={styles.cardTitle}>보호자</h2>
            {isConnected ? (
              <div className={styles.connectedRow}>
                <div className={styles.connectedInfo}>
                  <span className={styles.connectedAvatar} aria-hidden="true">
                    <img src={guardianCoupleImage} alt="" />
                  </span>
                  <div>
                    <p className={styles.connectedName}>{mockGuardianName}</p>
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
                <p className={styles.emptyConnectionText}>연결된 보호자가 없어요</p>
                <Link to="/senior/connection">
                  <Button type="button" variant="outline">
                    연결하기
                  </Button>
                </Link>
              </div>
            )}
          </Card>

          <Card>
            <SetCheckinReminderAction value={checkinReminder} onChange={setCheckinReminder} />
          </Card>

          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </main>
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </>
  )
}
