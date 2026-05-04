export function toHHMM(timeStr) {
  if (!timeStr) return ''
  return timeStr.slice(0, 5)
}

export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${period} ${hour}시` : `${period} ${hour}시 ${m}분`
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)} ~ ${formatTime(end)}`
}

// times: [{ start_time, end_time }, ...] — 참여자별 시간 레코드
// 반환: { overlapStart, overlapEnd } | null
export function calcOverlap(times) {
  if (!times || times.length === 0) return null
  const starts = times.map(t => t.start_time).filter(Boolean)
  const ends   = times.map(t => t.end_time).filter(Boolean)
  if (starts.length !== times.length || ends.length !== times.length) return null
  const maxStart = starts.reduce((a, b) => (a > b ? a : b))
  const minEnd   = ends.reduce((a, b) => (a < b ? a : b))
  return maxStart < minEnd ? { overlapStart: maxStart, overlapEnd: minEnd } : null
}
