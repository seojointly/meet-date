import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import HeatmapCell from './HeatmapCell'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Calendar({
  mode = 'range',          // 'range' | 'multi'
  initialYear,
  initialMonth,
  minDate,
  allowedDates,            // Set<string> — multi mode only
  selectedDates,           // Set<string> — my selections (multi)
  onDateToggle,            // (dateStr: string) => void
  rangeFrom,               // string | null (range)
  rangeTo,                 // string | null (range)
  onRangeChange,           // (from: string|null, to: string|null) => void
  heatmapData,             // Map<string, {voters:[{name,color}], allAvailable:bool}>
  isEditMode,              // bool — show my selections in sky blue
  confirmedDate,           // string | null — show ⭐ on confirmed cell
}) {
  const now = new Date()
  const [year, setYear]         = useState(initialYear  ?? now.getFullYear())
  const [month, setMonth]       = useState(initialMonth ?? now.getMonth())
  const [hover, setHover]       = useState(null)
  const [dragPreview, setDragPreview] = useState(new Set())

  const todayStr = toDateStr(now)
  const minStr   = minDate ?? todayStr

  // Stable refs — update every render so handlers never have stale values
  const dragStartRef   = useRef(null)
  const dragCurrentRef = useRef(null)
  const selRef         = useRef(selectedDates)
  const toggleRef      = useRef(onDateToggle)
  const allowedRef     = useRef(allowedDates)
  selRef.current     = selectedDates
  toggleRef.current  = onDateToggle
  allowedRef.current = allowedDates

  // ── Drag helpers ─────────────────────────────────────────────────
  function getDatesInRange(a, b) {
    if (!a || !b) return []
    const lo = a <= b ? a : b
    const hi = a <= b ? b : a
    const result = []
    const cur = new Date(lo + 'T00:00:00')
    const end = new Date(hi + 'T00:00:00')
    while (cur <= end) {
      const ds = toDateStr(cur)
      if (!allowedRef.current || allowedRef.current.has(ds)) result.push(ds)
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }

  function finalizeDrag() {
    const start   = dragStartRef.current
    const current = dragCurrentRef.current
    if (!start) return
    const range = getDatesInRange(start, current)
    if (range.length > 0) {
      const sel      = selRef.current
      const anyUnsel = range.some(d => !(sel?.has(d) ?? false))
      range.forEach(d => {
        const isSel = sel?.has(d) ?? false
        if (anyUnsel ? !isSel : isSel) toggleRef.current?.(d)
      })
    }
    dragStartRef.current   = null
    dragCurrentRef.current = null
    setDragPreview(new Set())
  }

  // ── Grid pointer handlers ─────────────────────────────────────────
  function handleGridPointerDown(e) {
    if (mode !== 'multi') return
    const dateEl = e.target.closest('[data-date]')
    const ds = dateEl?.getAttribute('data-date')
    if (!ds || dateEl?.getAttribute('data-disabled') === 'true') return
    dragStartRef.current   = ds
    dragCurrentRef.current = ds
    setDragPreview(new Set([ds]))
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  function handleGridPointerMove(e) {
    if (mode !== 'multi' || !dragStartRef.current) return
    const el     = document.elementFromPoint(e.clientX, e.clientY)
    const dateEl = el?.closest('[data-date]')
    const ds     = dateEl?.getAttribute('data-date')
    if (!ds || ds === dragCurrentRef.current) return
    if (dateEl?.getAttribute('data-disabled') === 'true') return
    dragCurrentRef.current = ds
    setDragPreview(new Set(getDatesInRange(dragStartRef.current, ds)))
  }

  function handleGridPointerUp(e) {
    if (mode !== 'multi') return
    finalizeDrag()
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  function handleGridPointerCancel() {
    dragStartRef.current   = null
    dragCurrentRef.current = null
    setDragPreview(new Set())
  }

  // ── Navigation ───────────────────────────────────────────────────
  const canPrev = () => {
    const minD = new Date(minStr)
    return !(year < minD.getFullYear() || (year === minD.getFullYear() && month <= minD.getMonth()))
  }
  const canNext = () => !(year >= 2027 && month === 11)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // ── Range mode helpers ───────────────────────────────────────────
  function getRangeClass(ds) {
    if (!rangeFrom) return ''
    if (rangeFrom && rangeTo) {
      const lo = rangeFrom <= rangeTo ? rangeFrom : rangeTo
      const hi = rangeFrom <= rangeTo ? rangeTo  : rangeFrom
      if (ds === lo) return 'range-start'
      if (ds === hi) return 'range-end'
      if (ds > lo && ds < hi) return 'range-in'
      return ''
    }
    if (ds === rangeFrom) return 'range-start'
    if (hover && hover !== rangeFrom) {
      const lo = rangeFrom <= hover ? rangeFrom : hover
      const hi = rangeFrom <= hover ? hover     : rangeFrom
      if (ds === lo || ds === hi || (ds > lo && ds < hi)) return 'range-preview'
    }
    return ''
  }

  function handleRangeClick(ds) {
    if (rangeFrom && rangeTo) { onRangeChange?.(ds, null); return }
    if (!rangeFrom)            { onRangeChange?.(ds, null); return }
    if (ds === rangeFrom)      { onRangeChange?.(null, null); return }
    const lo = rangeFrom <= ds ? rangeFrom : ds
    const hi = rangeFrom <= ds ? ds        : rangeFrom
    onRangeChange?.(lo, hi)
  }

  // ── Build cells ──────────────────────────────────────────────────
  const firstDow    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canPrev()}
          aria-label="이전 달"
          className="p-3 lg:p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-gray-800">{year}년 {month + 1}월</span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={!canNext()}
          aria-label="다음 달"
          className="p-3 lg:p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-xs font-medium py-1 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div
        className="grid grid-cols-7 gap-0.5 select-none"
        style={{ touchAction: mode === 'multi' ? 'none' : undefined }}
        onPointerDown={handleGridPointerDown}
        onPointerMove={handleGridPointerMove}
        onPointerUp={handleGridPointerUp}
        onPointerCancel={handleGridPointerCancel}
      >
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e${idx}`} className="min-h-[44px]" />
          const ds      = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const dow     = new Date(year, month, d).getDay()
          const isPast  = ds < minStr
          const isAllowed = !allowedDates || allowedDates.has(ds)
          return (
            <HeatmapCell
              key={ds}
              day={d}
              dateStr={ds}
              dow={dow}
              isToday={ds === todayStr}
              isPast={isPast}
              isAllowed={isAllowed}
              isMySelection={selectedDates?.has(ds) ?? false}
              isDragPreview={mode === 'multi' && dragPreview.has(ds)}
              isEditMode={isEditMode}
              isConfirmed={!!confirmedDate && ds === confirmedDate}
              rangeClass={getRangeClass(ds)}
              mode={mode}
              heatData={heatmapData?.get(ds) ?? null}
              onHoverIn={mode === 'range' && rangeFrom && !rangeTo ? setHover : null}
              onHoverOut={mode === 'range' && rangeFrom && !rangeTo ? () => setHover(null) : null}
              onClick={mode === 'range' ? () => handleRangeClick(ds) : undefined}
              onKeyboardActivate={mode === 'multi' ? () => onDateToggle?.(ds) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
