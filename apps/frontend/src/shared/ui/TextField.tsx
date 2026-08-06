import { useId, useState, type InputHTMLAttributes } from 'react'
import styles from './TextField.module.css'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  icon: 'id' | 'password'
  error?: string
  /** 비밀번호 표시/숨기기 토글을 보여줄지 — icon="password"일 때만 의미 있음. */
  showToggle?: boolean
}

// 로그인 화면 목업의 B/C 컴포넌트(아이디/비밀번호 입력창, Default/Focus/
// Filled/Error 상태) 기준. 아이콘은 실제 디자인 에셋이 아직 없어 이모지로
// 대체함 — 아이콘 세트가 정해지면 교체할 것.
export function TextField({ icon, error, showToggle, className, ...rest }: TextFieldProps) {
  const [visible, setVisible] = useState(false)
  const inputId = useId()
  const errorId = useId()
  const isPassword = icon === 'password'
  const resolvedType = isPassword ? (showToggle && visible ? 'text' : 'password') : 'text'

  return (
    <div className={className}>
      <div className={[styles.field, error ? styles.fieldError : ''].join(' ')}>
        <span className={styles.icon} aria-hidden="true">
          {icon === 'id' ? (
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5.5 19c.7-3.3 3-5 6.5-5s5.8 1.7 6.5 5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <rect x="5" y="10" width="14" height="10" rx="3" />
              <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
            </svg>
          )}
        </span>
        <input
          {...rest}
          id={inputId}
          type={resolvedType}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {isPassword && showToggle && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? '비밀번호 숨기기' : '비밀번호 표시'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" />
              <circle cx="12" cy="12" r="2.5" />
              {!visible && <path d="m4 4 16 16" />}
            </svg>
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className={styles.errorText}>
          {error}
        </p>
      )}
    </div>
  )
}
