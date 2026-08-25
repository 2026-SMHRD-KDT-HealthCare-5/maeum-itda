import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractApiErrorMessage } from '../../../shared/api'
import { resolvePostAuthPath, useDelayedPending } from '../../../shared/lib'
import { Button, LoadingSpinner, TextField, Toggle } from '../../../shared/ui'
import { useSession } from '../../../entities/user'
import { login as requestLogin } from '../api'
import { validateLoginForm, type LoginFormErrors, type LoginFormValues } from '../model'
import styles from './LoginForm.module.css'

// LOGIN_01 (UC-00): 아이디/비밀번호 입력 + 자동 로그인 체크 + 로그인 버튼.
export function LoginForm() {
  const { login: setSession } = useSession()
  const navigate = useNavigate()
  const [values, setValues] = useState<LoginFormValues>({ id: '', password: '', autoLogin: true })
  const [errors, setErrors] = useState<LoginFormErrors>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showSubmitSpinner = useDelayedPending(isSubmitting)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setNotice(null)
    const nextErrors = validateLoginForm(values)
    setErrors(nextErrors)
    if (nextErrors.id || nextErrors.password) return

    setIsSubmitting(true)
    try {
      const result = await requestLogin(values)
      setSession(
        {
          userId: result.userId,
          loginId: result.loginId,
          name: result.name,
          role: result.role,
          accessToken: result.accessToken,
        },
        { remember: values.autoLogin },
      )
      navigate(resolvePostAuthPath(result.userId, result.role))
    } catch (error) {
      setNotice(extractApiErrorMessage(error, '로그인에 실패했어요. 다시 시도해주세요.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <TextField
        icon="id"
        placeholder="아이디"
        autoComplete="username"
        autoFocus
        value={values.id}
        error={errors.id}
        onChange={(event) => {
          setValues((v) => ({ ...v, id: event.target.value }))
          setErrors((e) => ({ ...e, id: undefined }))
        }}
      />
      <TextField
        icon="password"
        placeholder="비밀번호"
        autoComplete="current-password"
        showToggle
        value={values.password}
        error={errors.password}
        onChange={(event) => {
          setValues((v) => ({ ...v, password: event.target.value }))
          setErrors((e) => ({ ...e, password: undefined }))
        }}
      />
      <Toggle
        label="자동 로그인"
        checked={values.autoLogin}
        onChange={(autoLogin) => setValues((v) => ({ ...v, autoLogin }))}
      />
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        로그인
      </Button>
      {showSubmitSpinner && <LoadingSpinner overlay label="로그인하는 중이에요" />}
    </form>
  )
}
