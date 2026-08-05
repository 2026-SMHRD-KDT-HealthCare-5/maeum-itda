// 화면ID 미배정(신규, 결정사항 로그 §5) — 단순 브랜딩용 화면인지, 인증 상태
// 복원(localStorage 등 영속화가 아직 없어 지금은 새로고침 시 항상 로그아웃
// 상태)을 기다리는 초기화 화면인지 목적이 아직 확정되지 않았다. 목적이
// 정해지기 전까지는 정적 placeholder만 표시하고 자동 리다이렉트는 넣지 않는다.
export function SplashPage() {
  return (
    <main>
      <h1>마음잇다</h1>
    </main>
  )
}
