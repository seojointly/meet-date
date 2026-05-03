import { CheckCircle } from 'lucide-react'

function formatDateLong(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-').map(Number)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${m}월 ${d}일 ${days[new Date(y, m - 1, d).getDay()]}요일`
}

export default function ConfirmedBanner({ confirmedDate, onCancel }) {
  if (!confirmedDate) return null

  return (
    <div className="sticky top-0 z-40 w-full bg-green-500 text-white px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <CheckCircle size={18} className="shrink-0" />
        <span className="font-semibold text-sm truncate">
          {formatDateLong(confirmedDate)}로 확정되었습니다!
        </span>
      </div>
      <button
        onClick={onCancel}
        className="text-xs underline opacity-80 hover:opacity-100 transition-opacity shrink-0 ml-3"
      >
        확정 취소
      </button>
    </div>
  )
}
