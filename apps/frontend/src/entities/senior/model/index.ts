// SENIOR_HOME_01 / 화면설계서 메뉴구성 기준 최소 필드.
// 보호자-시니어 연결(UC-00-1)은 결정사항 로그 §1에서 MVP 포함으로 확정됨
// (이전엔 MVP 제외였다가 번복). 연결 요청/상태 자체는 entities/connection에서
// 다루고, 여기엔 guardian 쪽 connectedSeniorId와 대칭되는 최소 참조 필드만 둠.
// username/phone/checkinReminder는 결정사항 로그 §7 — Figma '시니어 내 정보'
// 화면(기본 정보 카드, 안부 알림 카드)을 채우기 위해 추가된 필드.
export interface Senior {
  id: string
  name: string
  username: string
  phone: string
  connectedGuardianId: string | null
  checkinReminder: {
    enabled: boolean
    time: string // "HH:mm", 서비스 기준 시간대(Asia/Seoul)
  }
}
