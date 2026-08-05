import { BottomTabBar, SENIOR_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'

// 화면ID 미배정(신규, 결정사항 로그 §5) — 시니어가 자신의 하루 기록을 직접
// 조회하는 화면. 대화 전문/요약/기분 상태/대화 여부 중 무엇을 얼마나
// 노출할지는 화면 설계 확정 전까지 미정이라 placeholder만 둔다.
export function SeniorDailyRecordPage() {
  return (
    <main>
      <h1>일간 기록</h1>
      <BottomTabBar items={SENIOR_TAB_ITEMS} />
    </main>
  )
}
