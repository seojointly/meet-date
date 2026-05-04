import { useNavigate } from 'react-router-dom'
import { formatDateFull } from '../domain/date'

export default function ConfirmedModal({ isOpen, confirmedDate, roomId, onClose }) {
  const navigate = useNavigate()

  if (!isOpen) return null

  function handleGoConfirmed() {
    onClose()
    navigate(`/confirmed/${roomId}`)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-w-sm rounded-2xl p-8 shadow-2xl animate-fade-in-up text-center">
        <p className="text-6xl mb-4">🎉</p>
        <h2 className="font-bold text-xl text-gray-900 mb-2">날짜가 확정되었습니다!</h2>
        <p className="text-green-600 font-semibold text-lg mb-6">
          {formatDateFull(confirmedDate)}
        </p>
        <hr className="border-gray-100 mb-6" />
        <button
          onClick={handleGoConfirmed}
          className="w-full bg-green-500 text-white py-3.5 min-h-[48px] rounded-xl font-bold hover:bg-green-600 active:bg-green-700 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          일정 확인하기
        </button>
      </div>
    </div>
  )
}
