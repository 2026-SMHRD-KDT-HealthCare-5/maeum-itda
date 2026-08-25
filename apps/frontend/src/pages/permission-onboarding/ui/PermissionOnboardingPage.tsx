import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiBell, FiCheck, FiLoader, FiMic, FiShield, FiX } from 'react-icons/fi'
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

interface PermissionRowProps {
  icon: typeof FiBell
  title: string
  description: string
  state: PermissionState
}

// 하나의 권한 카드 안에서 각 권한이 같은 행 구조와 상태 표현을 공유한다.
// 허용 결과는 색상뿐 아니라 아이콘과 문구로도 즉시 구분할 수 있게 한다.
function PermissionRow({ icon: Icon, title, description, state }: PermissionRowProps) {
  const StateIcon = STATE_ICON[state]

  return (
    <div className={styles.permissionRow}>
      <span className={styles.icon} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.permissionCopy}>
        <p className={styles.cardTitle}>{title}</p>
        <p className={styles.cardDescription}>{description}</p>
      </div>
      <p className={styles.status} data-state={state} role="status" aria-live="polite">
        <StateIcon className={state === 'checking' ? styles.spinning : undefined} />
        {STATE_LABEL[state]}
      </p>
    </div>
  )
}

async function requestNotificationPermission(): Promise<PermissionState> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const permission = await Notification.requestPermission()
  return permission === 'granted' ? 'granted' : 'denied'
}

async function requestMicPermission(): Promise<PermissionState> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return 'granted'
  } catch {
    return 'denied'
  }
}

// 화면ID 없음(신규) — 로그인/회원가입 직후 계정당 한 번, 마이크(시니어만)/알림
// 권한을 실제 기능(안부 대화, 위험 알림)을 만나기 전에 미리 확보한다. 버튼을
// 눌러야 요청이 나가는 방식이 아니라, 화면에 들어오면 기기가 알아서 순서대로
// 네이티브 권한 프롬프트를 띄운다 — 여기서는 권한만 미리 받아둘 뿐, 알림 on/off
// 자체(진짜 사용자 설정)는 senior-my-info/guardian-my-info의 기존 토글이 서버에
// 저장하고, push 구독도 그 토글이 켜질 때 처리한다(usePushSubscription).
export function PermissionOnboardingPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [notificationState, setNotificationState] = useState<PermissionState>('checking')
  const [micState, setMicState] = useState<PermissionState>('checking')

  const needsMic = session?.role === 'senior'

  useEffect(() => {
    if (!session) return
    let cancelled = false

    async function requestAll() {
      const notification = await requestNotificationPermission()
      if (cancelled) return
      setNotificationState(notification)

      if (needsMic) {
        const mic = await requestMicPermission()
        if (cancelled) return
        setMicState(mic)
      }
    }

    void requestAll()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 한 번만 순서대로 요청한다.
  }, [])

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
          title="필요한 권한을 확인해 주세요"
          description={
            needsMic
              ? '마음잇다의 안부 대화를 위해 두 가지 권한이 필요해요.'
              : '마음잇다의 소중한 소식을 전해드리기 위해 알림 권한이 필요해요.'
          }
        />
      </section>

      <section className={styles.permissionSection} aria-label="필요한 권한">
        <Card className={styles.permissionCard}>
          <PermissionRow
            icon={FiBell}
            title="알림"
            description="안부 알림과 보호자 소식을 놓치지 않도록 알려드려요."
            state={notificationState}
          />

          {needsMic && (
            <>
              <div className={styles.divider} />
              <PermissionRow
                icon={FiMic}
                title="마이크"
                description="다솔이와 편안하게 대화할 수 있도록 목소리를 사용해요."
                state={micState}
              />
            </>
          )}
        </Card>
      </section>

      <div className={styles.footer}>
        <p className={styles.privacyNote}>
          <FiShield aria-hidden="true" />
          언제든 기기 설정에서 변경할 수 있어요.
        </p>
        <Button type="button" onClick={handleContinue}>
          계속하기
        </Button>
      </div>
    </main>
  )
}
