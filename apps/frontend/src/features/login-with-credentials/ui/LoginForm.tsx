import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextField, Toggle } from '../../../shared/ui'
import { useSession } from '../../../entities/user'
import { mockResolveRole, validateLoginForm, type LoginFormErrors, type LoginFormValues } from '../model'
import styles from './LoginForm.module.css'

// LOGIN_01 (UC-00): 아이디/비밀번호 입력 + 자동 로그인 체크 + 로그인 버튼.
// 인증은 아직 목업 상태 — mockResolveRole 주석 참고.
export function LoginForm() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [values, setValues] = useState<LoginFormValues>({ id: '', password: '', autoLogin: true })
  const [errors, setErrors] = useState<LoginFormErrors>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validateLoginForm(values)
    setErrors(nextErrors)
    if (nextErrors.id || nextErrors.password) return

    const role = mockResolveRole(values)
    login({ userId: values.id, role })
    navigate(role === 'senior' ? '/senior' : '/guardian')
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <TextField
        icon="id"
        placeholder="아이디"
        autoComplete="username"
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
      <Button type="submit">로그인</Button>
    </form>
  )
}
