import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "../../pages/login";
import { SeniorHomePage } from "../../pages/senior-home";
import { SeniorConversationPage } from "../../pages/senior-conversation";
import { GuardianHomePage } from "../../pages/guardian-home";
import { GuardianReportPage } from "../../pages/guardian-report";
import { GuardianNotificationPage } from "../../pages/guardian-notification";
import { ProtectedRoute } from "./ProtectedRoute";

// UC-00 로그인 후 역할별 분기. 관리자 분기는 의도적으로 없음 — 관리자
// 화면은 결정사항 로그 §1에 따라 MVP 구현 범위에서 제외되어 pages/admin이
// 비어있는 채로 남아있음.
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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
        path="/guardian/notifications"
        element={
          <ProtectedRoute role="guardian">
            <GuardianNotificationPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
