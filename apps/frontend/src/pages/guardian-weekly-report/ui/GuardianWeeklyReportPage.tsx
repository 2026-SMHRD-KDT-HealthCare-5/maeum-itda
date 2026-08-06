import { useParams } from 'react-router-dom'
import { BottomTabBar, GUARDIAN_TAB_ITEMS } from '../../../widgets/bottom-tab-bar'

// 화면ID 미배정(신규, 결정사항 로그 §5) — GUARDIAN_HOME_01의 주간 대시보드를
// 확장할지 별도 화면으로 둘지는 아직 기획 결정 전이라, 우선 별도
// placeholder로 스캐폴딩해둔다. weekStart의 정확한 의미(주 시작 요일,
// 서비스 기준 시간대)는 여전히 미정 — entities/report의 WeeklyReport
// 타입과 함께 다시 정리할 것.
export function GuardianWeeklyReportPage() {
  const { weekStart } = useParams<{ weekStart: string }>()
  return (
    <main>
      <h1>주간 리포트 상세</h1>
      <p>weekStart: {weekStart}</p>
      <BottomTabBar items={GUARDIAN_TAB_ITEMS} />
    </main>
  )
}
