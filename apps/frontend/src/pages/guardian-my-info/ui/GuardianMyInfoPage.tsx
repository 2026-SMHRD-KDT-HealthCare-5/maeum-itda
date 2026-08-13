import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DisconnectConnectionAction } from '../../../features/disconnect-connection'
import {
  EditBasicInfoAction,
  formatPhoneNumber,
  updateMyProfile,
} from '../../../features/edit-basic-info'
import {
  SetNotificationThresholdAction,
  type NotificationThresholdValue,
} from '../../../features/set-notification-threshold'
import { formatConnectionDuration, type Connection } from '../../../entities/connection'
import { fetchMyProfile, MY_PROFILE_QUERY_KEY, useSession } from '../../../entities/user'
import { Button, Card } from '../../../shared/ui'
import guardianCoupleImage from '../../../shared/assets/illustrations/guardian-couple.png'
import seniorCoupleImage from '../../../shared/assets/illustrations/senior-couple.png'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './MyInfoPage.module.css'

// 결정사항 로그 §7 — Figma '보호자 내 정보' 화면 최초 반영. 기존 별도
// 화면이던 UC-12(알림 설정)를 여기로 흡수했다. 연결/알림 임계치는 아직
// API가 없어 페이지 로컬 mock 상태로 둔다(기본 정보만 실제 GET/PATCH /users/me).
const mockSeniorName = '김순자'

export function GuardianMyInfoPage() {
  const { logout } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const profileQuery = useQuery({ queryKey: MY_PROFILE_QUERY_KEY, queryFn: fetchMyProfile })
  const updateProfileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (updated) => queryClient.setQueryData(MY_PROFILE_QUERY_KEY, updated),
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

  if (profileQuery.isPending) {
    return (
      <>
        <main className={styles.page}>
          <h1 className={styles.pageTitle}>내 정보</h1>
          <p className={styles.statusMessage} role="status">
            내 정보를 불러오는 중이에요...
          </p>
        </main>
        <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
      </>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <>
        <main className={styles.page}>
          <h1 className={styles.pageTitle}>내 정보</h1>
          <div className={styles.errorState} role="alert">
            <p>내 정보를 불러오지 못했어요.</p>
            <Button type="button" onClick={() => profileQuery.refetch()}>
              다시 시도
            </Button>
          </div>
        </main>
        <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
      </>
    )
  }

  const profile = profileQuery.data

  return (
    <>
      <main className={styles.page}>
        <h1 className={styles.pageTitle}>내 정보</h1>
        <header className={styles.header}>
          <img className={styles.avatar} src={guardianCoupleImage} alt="" />
          <h1 className={styles.name}>{profile.name} 보호자</h1>
        </header>

        <div className={styles.cards}>
          <Card className={styles.infoCard}>
            <EditBasicInfoAction
              variant="guardian"
              values={{
                username: profile.loginId,
                name: profile.name,
                phone: formatPhoneNumber(profile.phone),
              }}
              onSave={(next) => updateProfileMutation.mutate(next)}
            />
            {updateProfileMutation.isError && (
              <p className={styles.saveError}>저장에 실패했어요. 다시 시도해주세요.</p>
            )}
          </Card>

          <Card className={styles.connectionCard}>
            <h2 className={styles.cardTitle}>연결된 어르신</h2>
            {isConnected ? (
              <div className={styles.connectedRow}>
                <div className={styles.connectedInfo}>
                  <img className={styles.connectedAvatar} src={seniorCoupleImage} alt="" />
                  <div>
                    <p className={styles.connectedName}>{mockSeniorName}</p>
                    <p className={styles.connectedMeta}>
                      {formatConnectionDuration(connection.connectedAt)}
                    </p>
                  </div>
                </div>
                <DisconnectConnectionAction
                  variant="guardian"
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

          <Card className={styles.notificationCard}>
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
