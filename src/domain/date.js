export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function formatDateLong(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-').map(Number)
  return `${m}월 ${d}일 ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}요일`
}

export function formatDateFull(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

export function formatDateMedium(str) {
  if (!str) return ''
  const [, m, d] = str.split('-').map(Number)
  return `${m}월 ${d}일`
}

export function datesInRange(from, to) {
  const result = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cur <= end) {
    result.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    )
    cur.setDate(cur.getDate() + 1)
  }
  return result
}
