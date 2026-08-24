import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DisconnectConnectionAction } from '../../../features/disconnect-connection'
import {
  EditBasicInfoAction,
  formatPhoneNumber,
  updateMyProfile,
} from '../../../features/edit-basic-info'
import { usePushSubscription } from '../../../features/enable-push-notifications'
import {
  SetNotificationThresholdAction,
  NOTIFICATION_THRESHOLD_QUERY_KEY,
  fetchNotificationThreshold,
  updateNotificationThreshold,
  type NotificationThresholdValue,
} from '../../../features/set-notification-threshold'
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
import { Button, Card, LoadingSpinner, PageHeading } from '../../../shared/ui'
import guardianCoupleImage from '../../../shared/assets/illustrations/guardian-couple.webp'
import seniorCoupleImage from '../../../shared/assets/illustrations/senior-couple.webp'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'
import styles from './MyInfoPage.module.css'

// 결정사항 로그 §7 — Figma '보호자 내 정보' 화면 최초 반영. 기존 별도
// 화면이던 UC-12(알림 설정)를 여기로 흡수했다. 기본 정보/연결/알림 임계치
// 모두 실제 API에 연동됐다.

// 슬라이더 드래그 중 매 스텝마다 PATCH를 보내지 않도록 커밋을 묶어내는 지연 시간.
const NOTIFICATION_SAVE_DEBOUNCE_MS = 400

export function GuardianMyInfoPage() {
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

  const notificationQuery = useQuery({
    queryKey: NOTIFICATION_THRESHOLD_QUERY_KEY,
    queryFn: fetchNotificationThreshold,
  })
  const updateNotificationMutation = useMutation({
    mutationFn: updateNotificationThreshold,
    onSuccess: (updated) => queryClient.setQueryData(NOTIFICATION_THRESHOLD_QUERY_KEY, updated),
  })
  const [notificationDraft, setNotificationDraft] = useState<NotificationThresholdValue | null>(
    null,
  )
  const notificationSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (notificationSaveTimer.current) clearTimeout(notificationSaveTimer.current)
    }
  }, [])

  const pushSubscription = usePushSubscription()

  function handleNotificationChange(next: NotificationThresholdValue) {
    setNotificationDraft(next)
    if (notificationSaveTimer.current) clearTimeout(notificationSaveTimer.current)
    notificationSaveTimer.current = setTimeout(() => {
      updateNotificationMutation.mutate(next, { onSettled: () => setNotificationDraft(null) })
    }, NOTIFICATION_SAVE_DEBOUNCE_MS)
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isConnected = connectionQuery.data?.status === 'CONNECTED'

  // 프로필/연결/알림설정 셋 중 하나라도 아직 안 끝났으면 화면 전체를 오버레이로
  // 덮는다 — isPending이 이미 다 false여도 showLoadingOverlay가 hold 중이면
  // (최소 500ms 유지) 이 분기에 계속 머물러야 데이터 도착 즉시 튕기지 않는다.
  const anyPending =
    profileQuery.isPending || connectionQuery.isPending || notificationQuery.isPending
  const showLoadingOverlay = useDelayedPending(anyPending)

  if (anyPending || showLoadingOverlay) {
    return (
      <>
        <main className={styles.page}>
          <PageHeading eyebrow="마이페이지" title="내 정보" />
          {showLoadingOverlay && <LoadingSpinner overlay label="내 정보를 불러오는 중이에요" />}
        </main>
        <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
      </>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <>
        <main className={styles.page}>
          <PageHeading eyebrow="마이페이지" title="내 정보" />
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
  const displayedNotification = notificationDraft ?? notificationQuery.data ?? null

  return (
    <>
      <main className={styles.page}>
        <PageHeading
          eyebrow="마이페이지"
          title="내 정보"
          description="내 정보와 어르신 연결, 알림 기준을 관리해요."
        />
        <header className={styles.header}>
          <img className={styles.avatar} src={guardianCoupleImage} alt="" />
          <h2 className={styles.name}>{profile.name} 보호자</h2>
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
              onEditStart={() => updateProfileMutation.reset()}
              feedback={
                updateProfileMutation.isSuccess
                  ? { tone: 'success', message: '기본 정보가 저장됐어요.' }
                  : updateProfileMutation.isError
                    ? { tone: 'error', message: '저장에 실패했어요. 다시 시도해주세요.' }
                    : null
              }
            />
          </Card>

          <Card className={styles.connectionCard}>
            <h2 className={styles.cardTitle}>연결된 어르신</h2>
            {connectionQuery.isError && (
              <p className={styles.saveError}>연결 상태를 불러오지 못했어요.</p>
            )}
            {connectionQuery.isSuccess &&
              (isConnected ? (
                <div className={styles.connectedRow}>
                  <div className={styles.connectedInfo}>
                    <img className={styles.connectedAvatar} src={seniorCoupleImage} alt="" />
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
                    <p className={styles.emptyConnectionText}>아직 연결된 어르신이 없어요</p>
                    <p className={styles.emptyConnectionDescription}>
                      어르신의 아이디로 연결을 요청하면
                      <br />
                      안부와 리포트를 함께 확인할 수 있어요.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className={styles.connectButton}
                    onClick={() => navigate('/guardian/connection')}
                  >
                    어르신 연결하기
                  </Button>
                </div>
              ))}
          </Card>

          <Card className={styles.notificationCard}>
            {notificationQuery.isError && (
              <p className={styles.saveError}>알림 설정을 불러오지 못했어요.</p>
            )}
            {displayedNotification && (
              <SetNotificationThresholdAction
                value={displayedNotification}
                onChange={handleNotificationChange}
                feedback={
                  updateNotificationMutation.isError
                    ? extractApiErrorMessage(updateNotificationMutation.error, '저장에 실패했어요.')
                    : null
                }
                pushPermissionDenied={pushSubscription.status === 'permission-denied'}
                pushBusy={pushSubscription.isBusy}
                pushError={pushSubscription.error}
                onRequestPushSubscribe={pushSubscription.subscribe}
                onRequestPushUnsubscribe={() => void pushSubscription.unsubscribe()}
              />
            )}
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
