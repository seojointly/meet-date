import { CheckCircle } from 'lucide-react'
import { formatDateLong } from '../domain/date'

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
