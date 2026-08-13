import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'

const NotFoundPage = lazy(() =>
  import('../../pages/not-found').then((m) => ({ default: m.NotFoundPage })),
)
const DebugErrorsPage = lazy(() =>
  import('../../pages/debug-errors').then((m) => ({ default: m.DebugErrorsPage })),
)

const SplashPage = lazy(() => import('../../pages/splash').then((m) => ({ default: m.SplashPage })))
const LoginPage = lazy(() => import('../../pages/login').then((m) => ({ default: m.LoginPage })))
const JoinPage = lazy(() => import('../../pages/join').then((m) => ({ default: m.JoinPage })))
const SeniorHomePage = lazy(() =>
  import('../../pages/senior-home').then((m) => ({ default: m.SeniorHomePage })),
)
const SeniorConversationPage = lazy(() =>
  import('../../pages/senior-conversation').then((m) => ({ default: m.SeniorConversationPage })),
)
const SeniorConnectionPage = lazy(() =>
  import('../../pages/senior-connection').then((m) => ({ default: m.SeniorConnectionPage })),
)
const SeniorDailyRecordPage = lazy(() =>
  import('../../pages/senior-daily-record').then((m) => ({ default: m.SeniorDailyRecordPage })),
)
const GuardianHomePage = lazy(() =>
  import('../../pages/guardian-home').then((m) => ({ default: m.GuardianHomePage })),
)
const GuardianReportPage = lazy(() =>
  import('../../pages/guardian-report').then((m) => ({ default: m.GuardianReportPage })),
)
const GuardianWeeklyReportPage = lazy(() =>
  import('../../pages/guardian-weekly-report').then((m) => ({
    default: m.GuardianWeeklyReportPage,
  })),
)
const GuardianNotificationPage = lazy(() =>
  import('../../pages/guardian-notification').then((m) => ({
    default: m.GuardianNotificationPage,
  })),
)
const GuardianConnectionPage = lazy(() =>
  import('../../pages/guardian-connection').then((m) => ({ default: m.GuardianConnectionPage })),
)
const SeniorMyInfoPage = lazy(() =>
  import('../../pages/senior-my-info').then((m) => ({ default: m.SeniorMyInfoPage })),
)
const GuardianMyInfoPage = lazy(() =>
  import('../../pages/guardian-my-info').then((m) => ({ default: m.GuardianMyInfoPage })),
)

// UC-00 로그인 후 역할별 분기. 관리자 분기는 의도적으로 없음 — 관리자
// 화면은 결정사항 로그 §1에 따라 MVP 구현 범위에서 제외되어 pages/admin이
// 비어있는 채로 남아있음.
//
// 페이지를 전부 React.lazy로 분리한 것은 guardian-home/guardian-weekly-report가
// 쓰는 recharts(EmotionTrendChart)가 메인 청크를 500KB 경고 이상으로 키웠기
// 때문 — 라우트 단위 스플리팅으로 recharts를 해당 라우트 청크에만 담는다.
export function AppRouter() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/debug/errors" element={<DebugErrorsPage />} />

        <Route
          path="/senior"
          element={
            <ProtectedRoute role="senior">
              <SeniorHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/senior/conversation"
          element={
            <ProtectedRoute role="senior">
              <SeniorConversationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/senior/connection"
          element={
            <ProtectedRoute role="senior">
              <SeniorConnectionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/senior/daily-record"
          element={
            <ProtectedRoute role="senior">
              <SeniorDailyRecordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/senior/my-info"
          element={
            <ProtectedRoute role="senior">
              <SeniorMyInfoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/guardian"
          element={
            <ProtectedRoute role="guardian">
              <GuardianHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/report"
          element={
            <ProtectedRoute role="guardian">
              <GuardianReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/report/weekly/:weekStart"
          element={
            <ProtectedRoute role="guardian">
              <GuardianWeeklyReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/notifications"
          element={
            <ProtectedRoute role="guardian">
              <GuardianNotificationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/connection"
          element={
            <ProtectedRoute role="guardian">
              <GuardianConnectionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guardian/my-info"
          element={
            <ProtectedRoute role="guardian">
              <GuardianMyInfoPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
