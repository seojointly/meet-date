// O(P×D) — allowedDates 순회 전 availabilities를 날짜로 pre-index
export function buildHeatmapData(allowedDates, availabilities, participants) {
  const map   = new Map()
  const total = participants.length

  const dateIndex = new Map()
  availabilities.forEach(a => {
    if (!a.participants) return
    ;(a.dates ?? []).forEach(d => {
      if (!dateIndex.has(d)) dateIndex.set(d, [])
      dateIndex.get(d).push({ name: a.participants.name, color: a.participants.color })
    })
  })

  allowedDates.forEach(date => {
    const voters = dateIndex.get(date) ?? []
    map.set(date, {
      voters,
      count: voters.length,
      allAvailable: total > 0 && voters.length === total,
    })
  })
  return map
}

// 득표수 내림차순, 동률은 날짜 오름차순 — [date, voters[]][] 반환
export function buildRanking(allowedDates, availabilities) {
  const countMap = new Map()
  allowedDates.forEach(d => countMap.set(d, []))
  availabilities.forEach(a => {
    const p = a.participants
    if (!p) return
    ;(a.dates ?? []).forEach(d => {
      if (countMap.has(d)) countMap.get(d).push({ name: p.name, color: p.color })
    })
  })
  return [...countMap.entries()]
    .filter(([, voters]) => voters.length > 0)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
}

export function hasUserSubmitted(availabilities, participantId) {
  if (!participantId) return false
  return availabilities.some(
    a => a.participant_id === participantId && (a.dates?.length ?? 0) > 0
  )
}
