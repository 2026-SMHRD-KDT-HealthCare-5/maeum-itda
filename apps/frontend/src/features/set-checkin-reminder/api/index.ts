import { apiClient } from '../../../shared/api'
import type { CheckinReminderValue } from '../model'

export async function fetchCheckinReminder(): Promise<CheckinReminderValue> {
  const { data } = await apiClient.users.profileSettingsControllerGetSeniorCheckinSetting()
  return { enabled: data.enabled, time: data.time }
}

export async function updateCheckinReminder(
  next: Partial<CheckinReminderValue>,
): Promise<CheckinReminderValue> {
  const { data } = await apiClient.users.profileSettingsControllerUpdateSeniorCheckinSetting(next)
  return { enabled: data.enabled, time: data.time }
}
