import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'

// 화면ID 미배정(신규, 결정사항 로그 §5) — GUARDIAN_HOME_01의 주간 대시보드를
// 확장할지 별도 화면으로 둘지는 아직 기획 결정 전이라, 우선 별도
// placeholder로 스캐폴딩해둔다. 주 시작 요일/서비스 기준 시간대 확정 시
// entities/report의 WeeklyReport 타입과 함께 다시 정리할 것.
export function GuardianWeeklyReportPage() {
  return (
    <main>
      <h1>주간 리포트 상세</h1>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </main>
  )
}
