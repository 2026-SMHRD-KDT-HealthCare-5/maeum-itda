import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "../../pages/login";
import { JoinPage } from "../../pages/join";
import { SeniorHomePage } from "../../pages/senior-home";
import { SeniorConversationPage } from "../../pages/senior-conversation";
import { SeniorConnectionPage } from "../../pages/senior-connection";
import { GuardianHomePage } from "../../pages/guardian-home";
import { GuardianReportPage } from "../../pages/guardian-report";
import { GuardianNotificationPage } from "../../pages/guardian-notification";
import { GuardianNotificationSettingsPage } from "../../pages/guardian-notification-settings";
import { GuardianConnectionPage } from "../../pages/guardian-connection";
import { SeniorMyInfoPage } from "../../pages/senior-my-info";
import { GuardianMyInfoPage } from "../../pages/guardian-my-info";
import { ProtectedRoute } from "./ProtectedRoute";

// UC-00 로그인 후 역할별 분기. 관리자 분기는 의도적으로 없음 — 관리자
// 화면은 결정사항 로그 §1에 따라 MVP 구현 범위에서 제외되어 pages/admin이
// 비어있는 채로 남아있음.
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join" element={<JoinPage />} />

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
        path="/guardian/notifications"
        element={
          <ProtectedRoute role="guardian">
            <GuardianNotificationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guardian/notification-settings"
        element={
          <ProtectedRoute role="guardian">
            <GuardianNotificationSettingsPage />
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

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
