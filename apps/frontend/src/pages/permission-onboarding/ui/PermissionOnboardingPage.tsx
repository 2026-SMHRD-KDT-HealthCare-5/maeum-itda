import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiBell, FiCheck, FiLoader, FiShield, FiX } from 'react-icons/fi'
import { useSession } from '../../../entities/user'
import { Button, Card, PageHeading } from '../../../shared/ui'
import { homePathForRole, markPermissionOnboardingComplete } from '../../../shared/lib'
import permissionDaseul from '../../../shared/assets/character/character-daseul-permission.webp'
import styles from './PermissionOnboardingPage.module.css'

type PermissionState = 'checking' | 'granted' | 'denied' | 'unsupported'

const STATE_LABEL: Record<PermissionState, string> = {
  checking: '확인 중',
  granted: '허용됨',
  denied: '허용 안 됨',
  unsupported: '지원 안 됨',
}

const STATE_ICON = {
  checking: FiLoader,
  granted: FiCheck,
  denied: FiX,
  unsupported: FiAlertCircle,
} satisfies Record<PermissionState, typeof FiCheck>

async function requestNotificationPermission(): Promise<PermissionState> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const permission = await Notification.requestPermission()
  return permission === 'granted' ? 'granted' : 'denied'
}

// 화면ID 없음(신규) — 로그인/회원가입 직후 계정당 한 번, 알림 권한을 실제
// 기능(위험 알림, 안부 알림)을 만나기 전에 미리 확보한다. 버튼을 눌러야
// 요청이 나가는 방식이 아니라, 화면에 들어오면 기기가 알아서 네이티브 권한
// 프롬프트를 띄운다 — 여기서는 권한만 미리 받아둘 뿐, 알림 on/off 자체(진짜
// 사용자 설정)는 senior-my-info/guardian-my-info의 기존 토글이 서버에 저장하고,
// push 구독도 그 토글이 켜질 때 처리한다(usePushSubscription).
//
// 마이크 권한은 여기서 다루지 않는다 — 자동 발사되는 두 번째 권한 요청은
// 사용자 제스처가 없다고 판단한 브라우저(특히 PWA standalone)가 프롬프트
// 자체를 안 띄우고 조용히 무한 대기시키는 문제가 있었다(2026-08-25). 마이크는
// 이미 안부 대화를 실제로 시작하는 시점에 features/record-voice-answer가
// 요청하고 거부 시에도 정상 진행되도록 처리돼 있으므로, 그 지점 하나로 충분하다.
export function PermissionOnboardingPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [notificationState, setNotificationState] = useState<PermissionState>('checking')
  const StatusIcon = STATE_ICON[notificationState]

  useEffect(() => {
    if (!session) return
    let cancelled = false

    requestNotificationPermission().then((result) => {
      if (!cancelled) setNotificationState(result)
    })

    return () => {
      cancelled = true
    }
  }, [session])

  if (!session) return <Navigate to="/login" replace />

  function handleContinue() {
    markPermissionOnboardingComplete(session!.userId)
    navigate(homePathForRole(session!.role), { replace: true })
  }

  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-label="권한 안내">
        <div className={styles.characterSlot}>
          <img
            className={styles.character}
            src={permissionDaseul}
            alt="두 팔을 벌려 안내하는 다솔이"
          />
        </div>
        <PageHeading
          eyebrow="시작하기 전에"
          title="알림 권한을 확인해 주세요"
          description="마음잇다의 소중한 소식을 전해드리기 위해 알림 권한이 필요해요."
        />
      </section>

      <section className={styles.permissionSection} aria-label="필요한 권한">
        <Card className={styles.permissionCard}>
          <div className={styles.permissionRow}>
            <span className={styles.icon} aria-hidden="true">
              <FiBell />
            </span>
            <div className={styles.permissionCopy}>
              <p className={styles.cardTitle}>알림</p>
              <p className={styles.cardDescription}>
                안부 알림과 보호자 소식을 놓치지 않도록 알려드려요.
              </p>
            </div>
            <p
              className={styles.status}
              data-state={notificationState}
              role="status"
              aria-live="polite"
            >
              <StatusIcon
                className={notificationState === 'checking' ? styles.spinning : undefined}
              />
              {STATE_LABEL[notificationState]}
            </p>
          </div>
        </Card>
      </section>

      <div className={styles.footer}>
        <p className={styles.privacyNote}>
          <FiShield aria-hidden="true" />
          언제든 기기 설정에서 변경할 수 있어요.
        </p>
        <Button type="button" onClick={handleContinue}>
          동의하고 계속하기
        </Button>
      </div>
    </main>
  )
}
