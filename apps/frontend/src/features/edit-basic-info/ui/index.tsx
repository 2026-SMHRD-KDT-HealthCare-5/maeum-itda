import { useState } from 'react'
import { InlineFeedback, type InlineFeedbackTone } from '../../../shared/ui'
import {
  formatPhoneNumber,
  validateBasicInfo,
  type BasicInfoErrors,
  type BasicInfoValues,
} from '../model'
import styles from './EditBasicInfoAction.module.css'

interface EditBasicInfoActionProps {
  values: BasicInfoValues
  onSave: (next: Pick<BasicInfoValues, 'name' | 'phone'>) => void
  onEditStart?: () => void
  feedback?: { tone: InlineFeedbackTone; message: string } | null
  variant?: 'default' | 'guardian'
}

// 결정사항 로그 §7 — 시니어/보호자 내 정보 화면의 "기본 정보" 카드(아이디는
// 읽기 전용, 이름/휴대폰만 편집 가능) 양쪽에서 공용으로 쓰는 액션.
export function EditBasicInfoAction({
  values,
  onSave,
  onEditStart,
  feedback,
  variant = 'default',
}: EditBasicInfoActionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState({ name: values.name, phone: values.phone })
  const [errors, setErrors] = useState<BasicInfoErrors>({})

  function startEditing() {
    onEditStart?.()
    setDraft({ name: values.name, phone: values.phone })
    setErrors({})
    setIsEditing(true)
  }

  function handleDone() {
    const nextErrors = validateBasicInfo(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSave(draft)
    setIsEditing(false)
  }

  return (
    <div className={variant === 'guardian' ? styles.guardian : undefined}>
      <div className={styles.header}>
        <h2 className={styles.title}>기본 정보</h2>
        {!isEditing && (
          <button
            type="button"
            className={styles.editButton}
            onClick={startEditing}
            aria-label="기본 정보 수정"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16v4Z" />
              <path d="m13 7 4 4" />
            </svg>
          </button>
        )}
      </div>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>아이디</span>
          <span className={styles.rowValue}>{values.username}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>이름</span>
          {isEditing ? (
            <input
              className={styles.field}
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              aria-label="이름"
            />
          ) : (
            <span className={styles.rowValue}>{values.name}</span>
          )}
        </div>
        {isEditing && errors.name && <p className={styles.error}>{errors.name}</p>}

        <div className={styles.row}>
          <span className={styles.rowLabel}>휴대폰 번호</span>
          {isEditing ? (
            <input
              className={styles.field}
              value={draft.phone}
              inputMode="numeric"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  phone: formatPhoneNumber(event.target.value),
                }))
              }
              aria-label="휴대폰 번호"
            />
          ) : (
            <span className={styles.rowValue}>{values.phone}</span>
          )}
        </div>
        {isEditing && errors.phone && <p className={styles.error}>{errors.phone}</p>}
      </div>

      {feedback && !isEditing && <InlineFeedback message={feedback.message} tone={feedback.tone} />}

      {isEditing && (
        <button type="button" className={styles.doneButton} onClick={handleDone}>
          완료
        </button>
      )}
    </div>
  )
}
