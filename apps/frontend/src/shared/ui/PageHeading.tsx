import type { ReactNode } from 'react'
import styles from './PageHeading.module.css'

type PageHeadingProps = {
  title: string
  eyebrow?: string
  description?: string
  action?: ReactNode
  className?: string
}

// 역할별 페이지가 같은 정보 계층을 유지하도록 제목과 선택적 액션만 렌더링한다.
// 탐색과 데이터 상태는 소유하지 않으며 각 페이지가 기존 흐름을 그대로 제어한다.
export function PageHeading({
  title,
  eyebrow,
  description,
  action,
  className = '',
}: PageHeadingProps) {
  return (
    <header className={[styles.heading, className].filter(Boolean).join(' ')}>
      <div className={styles.copy}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  )
}
