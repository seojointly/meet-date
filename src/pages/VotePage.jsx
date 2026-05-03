import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CalendarDays, WifiOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { useParticipants } from '../hooks/useParticipants'
import { useVotes } from '../hooks/useVotes'
import { useAppointment } from '../hooks/useAppointment'
import Calendar from '../components/Calendar'
import RankingList from '../components/RankingList'
import ParticipantBar from '../components/ParticipantBar'
import ConfirmedBanner from '../components/ConfirmedBanner'
import NameModal from '../components/NameModal'

// ── Helpers ──────────────────────────────────────────────────────
function datesInRange(from, to) {
  const result = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to   + 'T00:00:00')
  while (cur <= end) {
    result.push(
      `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`
    )
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function formatDateMedium(str) {
  if (!str) return ''
  const [, m, d] = str.split('-').map(Number)
  return `${m}월 ${d}일`
}

function buildHeatmapData(allowedDates, availabilities, participants) {
  const map = new Map()
  const total = participants.length
  allowedDates.forEach(date => {
    const voters = []
    availabilities.forEach(a => {
      if (a.participants && (a.dates ?? []).includes(date)) {
        voters.push({ name: a.participants.name, color: a.participants.color })
      }
    })
    map.set(date, {
      voters,
      count: voters.length,
      allAvailable: total > 0 && voters.length === total,
    })
  })
  return map
}

// ── ConnectionBanner ─────────────────────────────────────────────
function ConnectionBanner({ status }) {
  if (status !== 'disconnected') return null
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-xs text-center py-2 flex items-center justify-center gap-1.5">
      <WifiOff size={13} />
      실시간 연결이 끊겼습니다. 재연결 중…
    </div>
  )
}

// ── VotePage ─────────────────────────────────────────────────────
export default function VotePage() {
  const { roomId } = useParams()
  const showToast  = useToast()

  const [room, setRoom]               = useState(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomError, setRoomError]     = useState(null)

  const [showNameModal, setShowNameModal] = useState(false)
  const [selectedDates, setSelectedDates] = useState(new Set())
  const [initDates, setInitDates]         = useState(false)
  const [saving, setSaving]               = useState(false)

  const {
    participants,
    loading: pLoading,
    participantId,
    isRestoringSession,
    registerParticipant,
  } = useParticipants(roomId)

  const { availabilities, connectionStatus, loading: vLoading, saveVotes } = useVotes(roomId)
  const { appointment, confirmDate, cancelAppointment } = useAppointment(roomId)

  // 재연결 토스트
  const prevStatus = useRef('connecting')
  useEffect(() => {
    if (prevStatus.current === 'disconnected' && connectionStatus === 'connected') {
      showToast('🟢 연결되었습니다', 'success')
    }
    prevStatus.current = connectionStatus
  }, [connectionStatus, showToast])

  // 방 로드
  useEffect(() => {
    if (!roomId) return
    supabase.from('rooms').select('*').eq('id', roomId).single()
      .then(({ data, error }) => {
        if (error || !data) {
          setRoomError('존재하지 않는 방입니다.')
        } else {
          setRoom(data)
          const month = parseInt(data.date_from.split('-')[1])
          document.title = `${month}월 모임 날짜 투표 | 날짜 맞춰`
        }
        setRoomLoading(false)
      })
  }, [roomId])

  // 세션 복원 완료 후 모달 표시 여부 결정
  useEffect(() => {
    if (isRestoringSession) return
    setShowNameModal(!participantId)
  }, [isRestoringSession, participantId])

  // 내 선택 날짜 초기화 (투표 데이터 로드 후 1회)
  useEffect(() => {
    if (initDates || vLoading || !participantId) return
    const my = availabilities.find(a => a.participant_id === participantId)
    setSelectedDates(new Set(my?.dates ?? []))
    setInitDates(true)
  }, [vLoading, participantId, availabilities, initDates])

  // 파생 데이터
  const allowedDates = useMemo(() => {
    if (!room) return new Set()
    return new Set(datesInRange(room.date_from, room.date_to))
  }, [room])

  const heatmapData = useMemo(
    () => buildHeatmapData(allowedDates, availabilities, participants),
    [allowedDates, availabilities, participants]
  )

  // ── 핸들러 ─────────────────────────────────────────────────────
  async function handleRegister(name) {
    await registerParticipant(name)
    setInitDates(false)
    setShowNameModal(false)
    showToast(`${name}으로 참여했어요!`, 'success')
  }

  function handleDateToggle(dateStr) {
    setSelectedDates(prev => {
      const next = new Set(prev)
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr)
      return next
    })
  }

  async function handleSaveVotes() {
    if (selectedDates.size === 0) {
      showToast('날짜를 1개 이상 선택해주세요', 'warning')
      return
    }
    if (!participantId) return
    setSaving(true)
    try {
      await saveVotes(participantId, [...selectedDates].sort())
      showToast('투표가 저장됐어요! 🎉', 'success')
    } catch {
      showToast('저장에 실패했어요. 다시 시도해주세요.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm(date) {
    try {
      await confirmDate(date)
      const [y, m, d] = date.split('-').map(Number)
      const days = ['일','월','화','수','목','금','토']
      showToast(`${m}월 ${d}일 ${days[new Date(y,m-1,d).getDay()]}요일로 확정됐어요! 🎉`, 'success')
    } catch {
      showToast('확정에 실패했어요.', 'error')
    }
  }

  async function handleCancelAppointment() {
    try {
      await cancelAppointment()
      showToast('확정이 취소됐어요.', 'info')
    } catch {
      showToast('취소에 실패했어요.', 'error')
    }
  }

  const myName = participants.find(p => p.id === participantId)?.name ?? ''

  // ── 로딩 / 에러 상태 ──────────────────────────────────────────
  if (roomLoading || isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (roomError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center bg-gray-50">
        <span className="text-5xl">😕</span>
        <p className="font-semibold text-gray-800">{roomError}</p>
        <Link
          to="/"
          className="text-green-600 underline text-sm focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded"
        >
          새 방 만들기
        </Link>
      </div>
    )
  }

  const confirmedDate = appointment?.confirmed_date ?? null
  const initialMonth  = room ? Number(room.date_from.split('-')[1]) - 1 : undefined
  const initialYear   = room ? Number(room.date_from.split('-')[0])      : undefined

  // ── 렌더 ──────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-gray-50 ${connectionStatus === 'disconnected' ? 'pt-8' : ''}`}>
      <ConnectionBanner status={connectionStatus} />

      {/* 상단 고정 영역 */}
      <div className="sticky top-0 z-40">
        <ConfirmedBanner confirmedDate={confirmedDate} onCancel={handleCancelAppointment} />
        <header className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-2">
            <CalendarDays size={20} className="text-green-600" />
            <Link
              to="/"
              className="font-bold text-gray-800 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded"
            >
              날짜 맞춰
            </Link>
            {room && (
              <span className="text-xs text-gray-400 ml-2">
                {formatDateMedium(room.date_from)} ~ {formatDateMedium(room.date_to)}
              </span>
            )}
            {myName && (
              <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {myName}
              </span>
            )}
          </div>
        </header>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="max-w-5xl mx-auto px-4 py-5">
        {/* 모바일: 단일 컬럼 / PC(lg+): 60%-40% 2컬럼 */}
        <div className="lg:grid lg:grid-cols-[60%_40%] lg:gap-6">

          {/* ── 좌: 캘린더 카드 ── */}
          <div className="space-y-4 mb-5 lg:mb-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-800">날짜 선택</h2>
                  <p className="text-xs text-gray-400 mt-0.5">진할수록 많은 사람이 가능한 날짜예요</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  selectedDates.size > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedDates.size}개 선택
                </span>
              </div>

              {!pLoading && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <ParticipantBar participants={participants} availabilities={availabilities} />
                </div>
              )}

              <Calendar
                mode="multi"
                initialYear={initialYear}
                initialMonth={initialMonth}
                minDate={room?.date_from}
                allowedDates={allowedDates}
                selectedDates={selectedDates}
                onDateToggle={handleDateToggle}
                heatmapData={heatmapData}
              />

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 flex-wrap">
                <span className="text-xs text-gray-400">투표 인원</span>
                <span className="text-xs text-gray-400">적음</span>
                {['#bbf7d0','#86efac','#4ade80','#16a34a','#14532d'].map((c, i) => (
                  <span key={i} className="w-4 h-4 rounded" style={{ backgroundColor: c }} />
                ))}
                <span className="text-xs text-gray-400">많음</span>
              </div>

              <button
                onClick={handleSaveVotes}
                disabled={saving || !participantId}
                className="mt-4 w-full bg-green-500 text-white py-3 min-h-[48px] rounded-xl font-bold hover:bg-green-600 active:bg-green-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                {saving ? '저장 중…' : '투표 저장'}
              </button>
            </div>
          </div>

          {/* ── 우: 순위 카드 ── */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
              <div className="mb-4">
                <h2 className="font-bold text-gray-800">📊 가능한 날짜 순위</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {participants.length > 0
                    ? `${participants.length}명 참여 중`
                    : '아직 참여자가 없어요'}
                </p>
              </div>
              <RankingList
                allowedDates={allowedDates}
                availabilities={availabilities}
                participants={participants}
                confirmedDate={confirmedDate}
                onConfirm={handleConfirm}
                onCancel={handleCancelAppointment}
              />
            </div>
          </div>
        </div>
      </main>

      <NameModal
        isOpen={showNameModal}
        participants={participants}
        onSubmit={handleRegister}
      />
    </div>
  )
}
