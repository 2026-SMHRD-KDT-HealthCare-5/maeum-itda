export interface NotificationThresholdValue {
  enabled: boolean
  threshold: number // 정서지수 전체 범위인 0~100
}

export const THRESHOLD_MIN = 0
export const THRESHOLD_MAX = 100
