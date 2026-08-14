export interface CheckinReminderValue {
  enabled: boolean
  time: string // "HH:mm"
}

export const CHECKIN_REMINDER_QUERY_KEY = ['checkin-reminder'] as const
