import { Navigate } from 'react-router-dom'

// 화면ID 미배정(신규, 결정사항 로그 §5) — 단순 브랜딩용 화면인지, 인증 상태
// 복원(localStorage 등 영속화가 아직 없어 지금은 새로고침 시 항상 로그아웃
// 상태)을 기다리는 초기화 화면인지 목적은 아직 확정되지 않았다. 다만 목적과
// 무관하게 "/"에서 빠져나갈 방법이 없는 건 실제 결함이라, 지금은 항상
// /login으로 보낸다 — 인증 복원이 생기면 이 즉시 리다이렉트를 그 로직으로
// 교체할 것.
export function SplashPage() {
  return <Navigate to="/login" replace />
}
