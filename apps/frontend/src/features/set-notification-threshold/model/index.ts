export interface NotificationThresholdValue {
  enabled: boolean
  threshold: number // 20~80, 결정사항 로그 §1 "낮게 30 / 보통 50 / 높게 70" 프리셋 범위 참고
}

export const THRESHOLD_MIN = 20
export const THRESHOLD_MAX = 80
