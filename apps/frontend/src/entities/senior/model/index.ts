// SENIOR_HOME_01 / 화면설계서 메뉴구성 기준 최소 필드.
// 보호자-시니어 연결(UC-00-1)은 결정사항 로그 §1에서 MVP 포함으로 확정됨
// (이전엔 MVP 제외였다가 번복). 연결 요청/상태 자체는 entities/connection에서
// 다루고, 여기엔 guardian 쪽 connectedSeniorId와 대칭되는 최소 참조 필드만 둠.
export interface Senior {
  id: string
  name: string
  connectedGuardianId: string | null
}
