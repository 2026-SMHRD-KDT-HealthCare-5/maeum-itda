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
  SetCheckinReminderAction,
  type CheckinReminderValue,
} from '../../../features/set-checkin-reminder'
import {
  CONNECTION_QUERY_KEY,
  EMPTY_CONNECTION,
  fetchMyConnection,
  disconnectConnection,
  formatConnectionDuration,
} from '../../../entities/connection'
import { fetchMyProfile, MY_PROFILE_QUERY_KEY, useSession } from '../../../entities/user'
import { extractApiErrorMessage } from '../../../shared/api'
import { Button, Card } from '../../../shared/ui'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import guardianCoupleImage from '../../../shared/assets/illustrations/guardian-couple.png'
import seniorCoupleImage from '../../../shared/assets/illustrations/senior-couple.png'
import styles from './MyInfoPage.module.css'

// 결정사항 로그 §7 — Figma '시니어 내 정보' 화면 최초 반영. 안부 알림 시간은
// 아직 API가 없어 페이지 로컬 mock 상태로 둔다(기본 정보/보호자 연결은 실제 API 연동).
export function SeniorMyInfoPage() {
  const { logout } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const profileQuery = useQuery({ queryKey: MY_PROFILE_QUERY_KEY, queryFn: fetchMyProfile })
  const updateProfileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (updated) => queryClient.setQueryData(MY_PROFILE_QUERY_KEY, updated),
  })

  const connectionQuery = useQuery({
    queryKey: CONNECTION_QUERY_KEY,
    queryFn: fetchMyConnection,
  })
  const disconnectMutation = useMutation({
    mutationFn: disconnectConnection,
    onSuccess: () => queryClient.setQueryData(CONNECTION_QUERY_KEY, EMPTY_CONNECTION),
  })

  const [checkinReminder, setCheckinReminder] = useState<CheckinReminderValue>({
    enabled: true,
    time: '09:00',
  })

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isConnected = connectionQuery.data?.status === 'CONNECTED'

  if (profileQuery.isPending) {
    return (
      <main className={styles.page}>
        <p>내 정보를 불러오는 중이에요...</p>
      </main>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <main className={styles.page}>
        <p>내 정보를 불러오지 못했어요.</p>
        <Button type="button" onClick={() => profileQuery.refetch()}>
          다시 시도
        </Button>
      </main>
    )
  }

  const profile = profileQuery.data

  return (
    <>
      <main className={styles.page}>
        <header className={styles.header}>
          <h1>내 정보</h1>
          <span className={styles.avatar} aria-hidden="true">
            <img src={seniorCoupleImage} alt="" />
          </span>
          <p className={styles.name}>{profile.name} 어르신</p>
        </header>

        <div className={styles.cards}>
          <Card>
            <EditBasicInfoAction
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

          <Card>
            <h2 className={styles.cardTitle}>보호자</h2>
            {connectionQuery.isPending && <p>연결 상태를 불러오는 중이에요...</p>}
            {connectionQuery.isError && (
              <p className={styles.saveError}>연결 상태를 불러오지 못했어요.</p>
            )}
            {connectionQuery.isSuccess &&
              (isConnected ? (
                <div className={styles.connectedRow}>
                  <div className={styles.connectedInfo}>
                    <span className={styles.connectedAvatar} aria-hidden="true">
                      <img src={guardianCoupleImage} alt="" />
                    </span>
                    <div>
                      <p className={styles.connectedName}>
                        {connectionQuery.data.counterpart?.name}
                      </p>
                      <p className={styles.connectedMeta}>
                        {formatConnectionDuration(connectionQuery.data.connectedAt)}
                      </p>
                    </div>
                  </div>
                  <DisconnectConnectionAction
                    onDisconnect={() => disconnectMutation.mutate()}
                    isDisconnecting={disconnectMutation.isPending}
                    error={
                      disconnectMutation.isError
                        ? extractApiErrorMessage(
                            disconnectMutation.error,
                            '연결 해제에 실패했어요.',
                          )
                        : null
                    }
                  />
                </div>
              ) : (
                <div className={styles.emptyConnection}>
                  <p className={styles.emptyConnectionText}>연결된 보호자가 없어요</p>
                  <Link to="/senior/connection">
                    <Button type="button" variant="outline">
                      요청 확인하기
                    </Button>
                  </Link>
                </div>
              ))}
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
