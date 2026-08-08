// 결정사항 로그 §7 — 연결일로부터 며칠째인지("N일째") 계산. connectedAt이
// 없으면(아직 연결 전) null.
export function daysSinceConnected(connectedAt: string | null): number | null {
  if (!connectedAt) return null

  const connectedDate = new Date(connectedAt)
  const today = new Date()
  const msPerDay = 1000 * 60 * 60 * 24

  return (
    Math.floor(
      (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
        Date.UTC(connectedDate.getFullYear(), connectedDate.getMonth(), connectedDate.getDate())) /
        msPerDay,
    ) + 1
  )
}

// 시니어/보호자 내 정보 화면의 "OOOO.M.D. 연결 · N일째" 표기에 쓰는 헬퍼.
export function formatConnectionDuration(connectedAt: string | null): string | null {
  if (!connectedAt) return null

  const connectedDate = new Date(connectedAt)
  const dayCount = daysSinceConnected(connectedAt)
  const formattedDate = `${connectedDate.getFullYear()}.${connectedDate.getMonth() + 1}.${connectedDate.getDate()}.`
  return `${formattedDate} 연결 · ${dayCount}일째`
}
