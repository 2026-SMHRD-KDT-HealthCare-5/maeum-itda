import { useId, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Button } from '../../../shared/ui'
import {
  formatPhoneNumber,
  validateRegisterAccount,
  type RegisterAccountErrors,
  type RegisterAccountField,
  type RegisterAccountValues,
  type RegisterRole,
} from '../model'
import guardianRoleImage from '../../../shared/assets/illustrations/guardian-couple.png'
import seniorRoleImage from '../../../shared/assets/illustrations/senior-couple.png'
import styles from './RegisterAccountAction.module.css'

const initialValues: RegisterAccountValues = {
  role: null,
  username: '',
  password: '',
  passwordConfirm: '',
  name: '',
  phone: '',
}

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

function FormField({ label, error, className, ...props }: FormFieldProps) {
  const inputId = useId()
  const errorId = useId()

  return (
    <div className={[styles.fieldGroup, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        className={[styles.input, error ? styles.inputError : ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      )}
    </div>
  )
}

export function RegisterAccountAction() {
  const usernameId = useId()
  const usernameErrorId = useId()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<RegisterAccountErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const updateValue = <K extends keyof RegisterAccountValues>(
    field: K,
    value: RegisterAccountValues[K],
  ) => {
    const next = { ...values, [field]: value }
    setValues(next)
    setNotice(null)
    if (submitted || errors[field]) {
      const nextErrors = validateRegisterAccount(next)
      setErrors((current) => ({ ...current, [field]: nextErrors[field] }))
    }
  }

  const selectRole = (role: RegisterRole) => updateValue('role', role)

  const handleUsernameCheck = () => {
    const usernameError = validateRegisterAccount(values).username
    setErrors((current) => ({ ...current, username: usernameError }))
    setNotice(usernameError ? null : '아이디 중복 확인은 회원가입 서버 연결 후 사용할 수 있어요.')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    const nextErrors = validateRegisterAccount(values)
    setErrors(nextErrors)

    const firstInvalidField = Object.keys(nextErrors)[0] as RegisterAccountField | undefined
    if (firstInvalidField) {
      const target = formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`)
      target?.focus()
      setNotice('필수 항목을 확인해주세요.')
      return
    }

    setNotice('회원가입 서버가 연결되면 가입을 완료할 수 있어요.')
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.roleFieldset}>
        <legend>어떤 역할로 가입하시나요?</legend>
        <div className={styles.roleGrid}>
          <label
            className={[styles.roleCard, values.role === 'senior' ? styles.roleSelected : ''].join(
              ' ',
            )}
          >
            <input
              className={styles.visuallyHidden}
              type="radio"
              name="role"
              value="senior"
              checked={values.role === 'senior'}
              onChange={() => selectRole('senior')}
            />
            <img className={styles.roleImage} src={seniorRoleImage} alt="" aria-hidden="true" />
            <strong>시니어</strong>
            <span>따뜻한 안부 대화를 해요</span>
          </label>
          <label
            className={[
              styles.roleCard,
              values.role === 'guardian' ? styles.roleSelected : '',
            ].join(' ')}
          >
            <input
              className={styles.visuallyHidden}
              type="radio"
              name="role"
              value="guardian"
              checked={values.role === 'guardian'}
              onChange={() => selectRole('guardian')}
            />
            <img className={styles.roleImage} src={guardianRoleImage} alt="" aria-hidden="true" />
            <strong>보호자</strong>
            <span>
              소중한 분의
              <br />
              리포트를 받아요
            </span>
          </label>
        </div>
        {errors.role && <p className={styles.error}>{errors.role}</p>}
      </fieldset>

      <div className={styles.usernameGroup}>
        <label className={styles.label} htmlFor={usernameId}>
          아이디
        </label>
        <div className={styles.usernameRow}>
          <input
            id={usernameId}
            className={[styles.input, errors.username ? styles.inputError : '']
              .filter(Boolean)
              .join(' ')}
            name="username"
            value={values.username}
            onChange={(event) => updateValue('username', event.target.value)}
            placeholder="영문, 숫자 4~20자"
            autoComplete="username"
            aria-invalid={errors.username ? true : undefined}
            aria-describedby={errors.username ? usernameErrorId : undefined}
          />
          <button className={styles.checkButton} type="button" onClick={handleUsernameCheck}>
            중복 확인
          </button>
        </div>
        {errors.username && (
          <p className={styles.error} id={usernameErrorId}>
            {errors.username}
          </p>
        )}
      </div>

      <FormField
        label="비밀번호"
        name="password"
        type="password"
        value={values.password}
        onChange={(event) => updateValue('password', event.target.value)}
        placeholder="4자 이상 입력해주세요"
        autoComplete="new-password"
        error={errors.password}
      />
      <FormField
        label="비밀번호 확인"
        name="passwordConfirm"
        type="password"
        value={values.passwordConfirm}
        onChange={(event) => updateValue('passwordConfirm', event.target.value)}
        placeholder="비밀번호를 다시 입력해주세요"
        autoComplete="new-password"
        error={errors.passwordConfirm}
      />
      <FormField
        label="이름"
        name="name"
        value={values.name}
        onChange={(event) => updateValue('name', event.target.value)}
        placeholder="이름을 입력해주세요"
        autoComplete="name"
        error={errors.name}
      />
      <FormField
        label="휴대폰 번호"
        name="phone"
        type="tel"
        inputMode="numeric"
        value={values.phone}
        onChange={(event) => updateValue('phone', formatPhoneNumber(event.target.value))}
        placeholder="010-0000-0000"
        autoComplete="tel"
        error={errors.phone}
      />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <Button type="submit" className={styles.submitButton}>
        가입하기
      </Button>
    </form>
  )
}
