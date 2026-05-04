import { memo, useState } from 'react'
import { HEAT_COLORS } from '../constants/colors'

function HeatmapCell({
  day,
  dateStr,
  dow,
  isToday,
  isPast,
  isAllowed,
  isMySelection,
  isDragPreview,
  isEditMode,
  isConfirmed,
  rangeClass,
  mode,
  heatData,
  onHoverIn,
  onHoverOut,
}) {
  const [tip, setTip] = useState(false)
  const disabled = isPast || (mode === 'multi' && !isAllowed)

  let bgStyle = {}
  if (mode === 'multi') {
    if (isEditMode && isMySelection) {
      bgStyle = { backgroundColor: '#bae6fd' }
    } else if (heatData?.voters.length > 0) {
      const idx = Math.min(heatData.voters.length, HEAT_COLORS.length - 1)
      bgStyle = { backgroundColor: HEAT_COLORS[idx] }
    }
  }

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
    'min-h-[44px] min-w-[44px]',
    'transition-all duration-150',
  ]

  if (disabled) {
    base.push('opacity-25 cursor-not-allowed')
    if (!isAllowed && mode === 'multi') base.push('text-gray-300')
  } else {
    base.push('cursor-pointer')
    if (!rangeBg && !bgStyle.backgroundColor) {
      base.push('hover:bg-gray-100 active:bg-gray-200')
    }
  }

  if (!disabled && !rangeBg) {
    if (dow === 0) base.push('text-red-500')
    else if (dow === 6) base.push('text-blue-500')
  }

  if (isToday && !rangeBg) base.push('ring-1 ring-inset ring-green-400 font-bold')

  if (isDragPreview) {
    base.push('ring-2 ring-green-400 ring-inset')
  } else if (isEditMode && isMySelection && mode === 'multi') {
    base.push('ring-2 ring-offset-1 ring-sky-400')
  } else if (isMySelection && mode === 'multi') {
    base.push('ring-2 ring-offset-1 ring-green-600')
  }

  if (rangeBg) base.push(rangeBg, rangeText)

  return (
    <div className="relative flex justify-center">
      <div
        className={base.join(' ')}
        style={rangeBg ? {} : bgStyle}
        data-date={dateStr}
        data-disabled={disabled || undefined}
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? -1 : 0}
        aria-label={dateStr}
        aria-pressed={isMySelection}
        onMouseEnter={() => { onHoverIn?.(dateStr); if (heatData?.voters.length) setTip(true) }}
        onMouseLeave={() => { onHoverOut?.(); setTip(false) }}
        onTouchStart={() => { if (heatData?.voters.length) setTip(t => !t) }}
      >
        {day}
        {isConfirmed && (
          <span className="absolute top-0.5 right-0.5 text-[10px] leading-none pointer-events-none">⭐</span>
        )}
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

export default memo(HeatmapCell, (prev, next) =>
  prev.dateStr === next.dateStr &&
  prev.isMySelection === next.isMySelection &&
  prev.isConfirmed === next.isConfirmed &&
  prev.heatData === next.heatData &&
  prev.isEditMode === next.isEditMode &&
  prev.isDragPreview === next.isDragPreview &&
  prev.rangeClass === next.rangeClass &&
  prev.onHoverIn === next.onHoverIn
)
