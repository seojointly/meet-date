import { useState } from 'react'

export default function HeatmapCell({
  day,
  dateStr,
  dow,
  isToday,
  isPast,
  isAllowed,
  isMySelection,
  rangeClass,
  mode,
  heatData,   // { voters: [{name,color}], allAvailable: boolean } | null
  onHoverIn,
  onHoverOut,
  onClick,
}) {
  const [tip, setTip] = useState(false)
  const disabled = isPast || (mode === 'multi' && !isAllowed)

  // ── heatmap background (multi mode only) ────────────────────────
  let bgStyle = {}
  if (mode === 'multi' && heatData?.voters.length > 0) {
    const vs = heatData.voters
    if (vs.length === 1) {
      bgStyle = { backgroundColor: vs[0].color + 'aa' }
    } else {
      const pct = 100 / vs.length
      const stops = vs.flatMap((v, i) => [
        `${v.color}aa ${(i * pct).toFixed(1)}%`,
        `${v.color}aa ${((i + 1) * pct).toFixed(1)}%`,
      ])
      bgStyle = { background: `linear-gradient(to bottom, ${stops.join(', ')})` }
    }
  }

  // ── range mode styling ───────────────────────────────────────────
  let rangeBg = ''
  let rangeText = ''
  if (mode === 'range') {
    if (rangeClass === 'range-start' || rangeClass === 'range-end') {
      rangeBg = 'bg-green-500'
      rangeText = 'text-white'
    } else if (rangeClass === 'range-in') {
      rangeBg = 'bg-green-100'
      rangeText = 'text-green-800'
    } else if (rangeClass === 'range-preview') {
      rangeBg = 'bg-green-100'
      rangeText = 'text-green-700'
    }
  }

  const base = [
    'relative flex items-center justify-center rounded-lg',
    'text-sm font-medium select-none',
    'min-h-[44px] min-w-[44px]',   // 44px touch target
    'transition-all duration-150',
  ]

  if (disabled) {
    base.push('opacity-25 cursor-not-allowed')
    if (!isAllowed && mode === 'multi') base.push('text-gray-300')
  } else {
    base.push('cursor-pointer')
    if (!rangeBg && !bgStyle.background && !bgStyle.backgroundColor) {
      base.push('hover:bg-gray-100 active:bg-gray-200')
    }
  }

  if (!disabled && !rangeBg) {
    if (dow === 0) base.push('text-red-500')
    else if (dow === 6) base.push('text-blue-500')
  }

  if (isToday && !rangeBg) base.push('ring-1 ring-inset ring-green-400 font-bold')

  if (isMySelection && mode === 'multi') {
    base.push('ring-2 ring-offset-1 ring-green-600')
  }

  if (heatData?.allAvailable && mode === 'multi') {
    base.push('animate-rank-pulse')
  }

  if (rangeBg) base.push(rangeBg, rangeText)

  return (
    <div className="relative flex justify-center">
      <div
        className={base.join(' ')}
        style={rangeBg ? {} : bgStyle}
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? -1 : 0}
        aria-label={dateStr}
        aria-pressed={isMySelection}
        onClick={disabled ? undefined : onClick}
        onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.() } }}
        onMouseEnter={() => { onHoverIn?.(dateStr); if (heatData?.voters.length) setTip(true) }}
        onMouseLeave={() => { onHoverOut?.(); setTip(false) }}
        onTouchStart={() => { if (heatData?.voters.length) setTip(t => !t) }}
      >
        {day}
      </div>

      {tip && heatData?.voters.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
            {heatData.voters.map(v => v.name).join(', ')} 가능
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}
