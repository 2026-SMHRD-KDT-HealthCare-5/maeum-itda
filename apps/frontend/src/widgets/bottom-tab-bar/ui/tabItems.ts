import type { TabItem } from './BottomTabBar'

// 시니어/보호자 각각의 모든 탭 화면(SeniorHome/SeniorMyInfo,
// GuardianHome/Report/Notification/MyInfo)에서 동일하게 써야 하는 목록이라
// 여기 한 곳에 고정한다 — pages끼리 서로 import하지 않고도 pages가 공유할
// 수 있는 가장 가까운 하위 레이어가 widgets이기 때문.
// (react-refresh/only-export-components 때문에 컴포넌트 파일과 분리함 —
// BottomTabBar.tsx만 컴포넌트를 export해야 Fast Refresh가 정상 동작함)
export const SENIOR_TAB_ITEMS: TabItem[] = [
  { label: '홈', to: '/senior', icon: 'home' },
  { label: '안부 대화', to: '/senior/conversation', icon: 'chat' },
  { label: '내 정보', to: '/senior/my-info', icon: 'user' },
]

export const GUARDIAN_TAB_ITEMS: TabItem[] = [
  { label: '홈', to: '/guardian', icon: 'home' },
  { label: '리포트', to: '/guardian/report', icon: 'report' },
  { label: '알림', to: '/guardian/notifications', icon: 'notification' },
  { label: '내 정보', to: '/guardian/my-info', icon: 'user' },
]
