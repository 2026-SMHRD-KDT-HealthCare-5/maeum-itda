import { apiClient } from '../../../shared/api'
import type { NotificationThresholdValue } from '../model'

export async function fetchNotificationThreshold(): Promise<NotificationThresholdValue> {
  const { data } = await apiClient.users.profileSettingsControllerGetGuardianAlertSetting()
  return { enabled: data.enabled, threshold: data.threshold }
}

export async function updateNotificationThreshold(
  next: Partial<NotificationThresholdValue>,
): Promise<NotificationThresholdValue> {
  const { data } = await apiClient.users.profileSettingsControllerUpdateGuardianAlertSetting(next)
  return { enabled: data.enabled, threshold: data.threshold }
}
