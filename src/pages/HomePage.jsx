import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, X, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import Calendar from '../components/Calendar'
import { MAX_PARTICIPANTS_LIMIT } from '../constants/colors'

function formatDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-').map(Number)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${m}월 ${d}일(${days[new Date(y, m - 1, d).getDay()]})`
}

function dateDiff(from, to) {
  return Math.round((new Date(to) - new Date(from)) / 86400000)
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-gray-200 bg-gray-50 font-bold text-xl text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          −
        </button>
        <span className="w-10 text-center font-bold text-gray-800 text-lg select-none">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-gray-200 bg-gray-50 font-bold text-xl text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [modalOpen, setModalOpen]             = useState(false)
  const [title, setTitle]                     = useState('')
  const [rangeFrom, setRangeFrom]             = useState(null)
  const [rangeTo, setRangeTo]                 = useState(null)
  const [maxParticipants, setMaxParticipants] = useState(4)
  const [creating, setCreating]               = useState(false)

  function handleRangeChange(from, to) {
    setRangeFrom(from)
    setRangeTo(to)
  }

  function openModal() {
    setTitle('')
    setRangeFrom(null)
    setRangeTo(null)
    setMaxParticipants(4)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  async function handleCreate() {
    if (!rangeFrom || !rangeTo) return
    setCreating(true)
    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          title: title.trim() || '모임',
          date_from: rangeFrom,
          date_to: rangeTo,
          max_participants: maxParticipants,
        })
        .select('id')
        .single()
      if (error) throw error

      const voteUrl = `${location.origin}/vote/${data.id}`
      try {
        await navigator.clipboard.writeText(voteUrl)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = voteUrl
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.appendChild(ta)
        ta.select()
        try { document.execCommand('copy') } catch { /* silent */ }
        document.body.removeChild(ta)
      }

      showToast('링크가 복사되었습니다! 🎉', 'success')
      closeModal()
      setTimeout(() => navigate(`/vote/${data.id}`), 700)
    } catch (err) {
      console.error('[createRoom]', err)
      showToast('방 생성에 실패했습니다. 다시 시도해주세요.', 'error')
      setCreating(false)
    }
  }

  const rangeReady = rangeFrom && rangeTo
  const diff = rangeReady ? dateDiff(rangeFrom, rangeTo) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col">
      {/* Header */}
      <header className="px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <CalendarDays size={22} className="text-green-600" />
          <span className="font-bold text-gray-800 text-lg">날짜 맞춰</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="text-center space-y-6 max-w-sm w-full">
          <div className="text-7xl">🗓️</div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">모임 날짜 투표</h1>
            <p className="text-gray-500 text-base">가능한 날짜를 선택하고 모임 날짜를 맞춰보세요</p>
          </div>
          <button
            onClick={openModal}
            className="w-full bg-green-500 text-white py-4 min-h-[48px] rounded-2xl font-bold text-lg hover:bg-green-600 active:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-200 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            방 만들기
          </button>
        </div>
      </main>

      {/* Modal overlay */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden animate-slide-up md:animate-fade-in-up">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto md:hidden absolute top-3 left-1/2 -translate-x-1/2" />
              <h2 className="font-bold text-gray-800">방 만들기</h2>
              <button
                onClick={closeModal}
                className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-gray-400"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-5">
              {/* 방 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">방 이름</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="예) 5월 MT, 생일 파티"
                  maxLength={20}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* 날짜 선택 */}
              <div>
                <p className="text-sm text-center text-gray-500 mb-4">
                  {!rangeFrom
                    ? '시작 날짜를 선택하세요'
                    : !rangeTo
                      ? '종료 날짜를 선택하세요'
                      : <span className="text-green-600 font-medium">날짜 범위가 선택됐어요 ✓</span>
                  }
                </p>

                <Calendar
                  mode="range"
                  rangeFrom={rangeFrom}
                  rangeTo={rangeTo}
                  onRangeChange={handleRangeChange}
                />

                {rangeReady && (
                  <div className="mt-4 flex items-center justify-center gap-3 bg-green-50 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-green-800">{formatDate(rangeFrom)}</span>
                    <ArrowRight size={16} className="text-green-500" />
                    <span className="text-sm font-semibold text-green-800">{formatDate(rangeTo)}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {diff === 0 ? '당일' : `${diff}일 간`}
                    </span>
                  </div>
                )}
              </div>

              {/* 인원 설정 */}
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <Stepper
                  label="최대 참여 인원"
                  value={maxParticipants}
                  min={2}
                  max={MAX_PARTICIPANTS_LIMIT}
                  onChange={setMaxParticipants}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-5 pb-6 space-y-2">
              <button
                onClick={handleCreate}
                disabled={!rangeReady || creating}
                className="w-full bg-green-500 text-white py-3.5 min-h-[48px] rounded-xl font-bold hover:bg-green-600 active:bg-green-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                {creating ? '생성 중…' : '방 생성하기'}
              </button>
              <button
                onClick={closeModal}
                className="w-full text-gray-500 py-2.5 min-h-[48px] rounded-xl font-medium hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all text-sm focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
