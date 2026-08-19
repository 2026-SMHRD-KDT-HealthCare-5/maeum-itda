import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DisconnectConnectionAction } from '../../../features/disconnect-connection'
import {
  EditBasicInfoAction,
  formatPhoneNumber,
  updateMyProfile,
} from '../../../features/edit-basic-info'
import {
  EnablePushNotificationsAction,
  usePushSubscription,
} from '../../../features/enable-push-notifications'
import {
  SetCheckinReminderAction,
  CHECKIN_REMINDER_QUERY_KEY,
  fetchCheckinReminder,
  updateCheckinReminder,
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
import { useDelayedPending } from '../../../shared/lib'
import { Button, Card, LoadingSpinner } from '../../../shared/ui'
import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import guardianCoupleImage from '../../../shared/assets/illustrations/guardian-couple.png'
import seniorCoupleImage from '../../../shared/assets/illustrations/senior-couple.png'
import styles from './MyInfoPage.module.css'

// 결정사항 로그 §7 — Figma '시니어 내 정보' 화면 최초 반영. 기본 정보/보호자
// 연결/안부 알림 시간 모두 실제 API에 연동됐다.
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

  const checkinReminderQuery = useQuery({
    queryKey: CHECKIN_REMINDER_QUERY_KEY,
    queryFn: fetchCheckinReminder,
  })
  const updateCheckinReminderMutation = useMutation({
    mutationFn: updateCheckinReminder,
    onSuccess: (updated) => queryClient.setQueryData(CHECKIN_REMINDER_QUERY_KEY, updated),
  })
  const [checkinDraft, setCheckinDraft] = useState<CheckinReminderValue | null>(null)

  // 안부 알림도 실제로는 웹 푸시로 전달되므로, 이 기기가 아직 푸시 구독 전이면
  // "안부 알림"을 켜봐야 아무것도 안 온다 — 켜려는 시도를 막고 아래 푸시
  // 토글부터 켜라고 안내한다.
  const pushSubscription = usePushSubscription()
  const [pushRequiredNotice, setPushRequiredNotice] = useState(false)

  function handleCheckinChange(next: CheckinReminderValue) {
    if (next.enabled && pushSubscription.status !== 'subscribed') {
      setPushRequiredNotice(true)
      return
    }
    setPushRequiredNotice(false)
    setCheckinDraft(next)
    updateCheckinReminderMutation.mutate(next, { onSettled: () => setCheckinDraft(null) })
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isConnected = connectionQuery.data?.status === 'CONNECTED'

  // 프로필/연결/안부알림 셋 중 하나라도 아직 안 끝났으면 화면 전체를 오버레이로
  // 덮는다 — isPending이 이미 다 false여도 showLoadingOverlay가 hold 중이면
  // (최소 500ms 유지) 이 분기에 계속 머물러야 데이터 도착 즉시 튕기지 않는다.
  const anyPending =
    profileQuery.isPending || connectionQuery.isPending || checkinReminderQuery.isPending
  const showLoadingOverlay = useDelayedPending(anyPending)

  if (anyPending || showLoadingOverlay) {
    return (
      <>
        <main className={styles.page}>
          <h1 className={styles.pageTitle}>내 정보</h1>
          {showLoadingOverlay && <LoadingSpinner overlay label="내 정보를 불러오는 중이에요" />}
        </main>
        <BottomTabBar items={SENIOR_TAB_ITEMS} />
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
        <BottomTabBar items={SENIOR_TAB_ITEMS} />
      </>
    )
  }

  const profile = profileQuery.data
  const displayedCheckinReminder = checkinDraft ?? checkinReminderQuery.data ?? null

  return (
    <>
      <main className={styles.page}>
        <h1 className={styles.pageTitle}>내 정보</h1>
        <header className={styles.header}>
          <img className={styles.avatar} src={seniorCoupleImage} alt="" />
          <h2 className={styles.name}>{profile.name} 어르신</h2>
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
            <h2 className={styles.cardTitle}>연결된 보호자</h2>
            {connectionQuery.isError && (
              <p className={styles.saveError}>연결 상태를 불러오지 못했어요.</p>
            )}
            {connectionQuery.isSuccess &&
              (isConnected ? (
                <div className={styles.connectedRow}>
                  <div className={styles.connectedInfo}>
                    <img className={styles.connectedAvatar} src={guardianCoupleImage} alt="" />
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
                    variant="guardian"
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
                  <span className={styles.emptyConnectionIcon} aria-hidden="true">
                    <svg viewBox="0 0 32 32" fill="none">
                      <circle cx="12" cy="11" r="4" />
                      <path d="M5.5 23c.6-4.1 3-6.2 6.5-6.2 2.3 0 4.2.9 5.3 2.7" />
                      <path d="M18.5 14.5h3a4 4 0 0 1 0 8h-3" />
                      <path d="M13.5 22.5h-3a4 4 0 0 1 0-8h3" />
                    </svg>
                  </span>
                  <div className={styles.emptyConnectionCopy}>
                    <p className={styles.emptyConnectionText}>아직 연결된 보호자가 없어요</p>
                    <p className={styles.emptyConnectionDescription}>
                      보호자가 연결을 요청하면
                      <br />
                      여기에서 요청을 확인할 수 있어요.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className={styles.connectButton}
                    onClick={() => navigate('/senior/connection')}
                  >
                    요청 확인하기
                  </Button>
                </div>
              ))}
          </Card>

          <Card className={styles.notificationCard}>
            {checkinReminderQuery.isError && (
              <p className={styles.saveError}>안부 알림 설정을 불러오지 못했어요.</p>
            )}
            {displayedCheckinReminder && (
              <SetCheckinReminderAction
                value={displayedCheckinReminder}
                onChange={handleCheckinChange}
                feedback={
                  pushRequiredNotice
                    ? "위 '알림 푸시 허용'을 먼저 켜주세요."
                    : updateCheckinReminderMutation.isError
                      ? extractApiErrorMessage(
                          updateCheckinReminderMutation.error,
                          '저장에 실패했어요.',
                        )
                      : null
                }
                beforeContent={
                  <EnablePushNotificationsAction
                    title="알림 푸시 허용"
                    description="안부 알림을 이 기기의 알림으로도 받아요"
                    pushSubscription={pushSubscription}
                  />
                }
              />
            )}
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
