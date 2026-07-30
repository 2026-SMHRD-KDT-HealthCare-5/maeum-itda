import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../../entities/user'
import { mockResolveRole, type LoginFormValues } from '../model'

// LOGIN_01 (UC-00): 아이디/비밀번호 입력 + 자동 로그인 체크 + 로그인 버튼.
// 인증은 아직 목업 상태 — mockResolveRole 주석 참고.
export function LoginForm() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [values, setValues] = useState<LoginFormValues>({ id: '', password: '', autoLogin: false })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const role = mockResolveRole(values)
    login({ userId: values.id || 'mock-user', role })
    navigate(role === 'senior' ? '/senior' : '/guardian')
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          placeholder="아이디"
          value={values.id}
          onChange={(event) => setValues((v) => ({ ...v, id: event.target.value }))}
        />
      </div>
      <div>
        <input
          type="password"
          placeholder="비밀번호"
          value={values.password}
          onChange={(event) => setValues((v) => ({ ...v, password: event.target.value }))}
        />
      </div>
      <label>
        <input
          type="checkbox"
          checked={values.autoLogin}
          onChange={(event) => setValues((v) => ({ ...v, autoLogin: event.target.checked }))}
        />
        자동 로그인
      </label>
      <button type="submit">로그인</button>
    </form>
  )
}
