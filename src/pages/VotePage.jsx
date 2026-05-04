import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { CalendarDays, WifiOff } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useParticipants } from '../hooks/useParticipants'
import { useVotes } from '../hooks/useVotes'
import { useAppointment } from '../hooks/useAppointment'
import { useRoom } from '../hooks/useRoom'
import Calendar from '../components/Calendar'
import RankingList from '../components/RankingList'
import ParticipantBar from '../components/ParticipantBar'
import ConfirmedBanner from '../components/ConfirmedBanner'
import ConfirmedModal from '../components/ConfirmedModal'
import NameModal from '../components/NameModal'
import { formatDateLong, formatDateMedium, datesInRange } from '../utils/date'
import { HEAT_COLORS } from '../constants/colors'

// O(P×D) — pre-indexes availabilities by date before iterating allowedDates
function buildHeatmapData(allowedDates, availabilities, participants) {
  const map   = new Map()
  const total = participants.length

  const dateIndex = new Map()
  availabilities.forEach(a => {
    if (!a.participants) return
    ;(a.dates ?? []).forEach(d => {
      if (!dateIndex.has(d)) dateIndex.set(d, [])
      dateIndex.get(d).push({ name: a.participants.name, color: a.participants.color })
    })
  })

  allowedDates.forEach(date => {
    const voters = dateIndex.get(date) ?? []
    map.set(date, {
      voters,
      count: voters.length,
      allAvailable: total > 0 && voters.length === total,
    })
  })
  return map
}

// ── ConnectionBanner ──────────────────────────────────────────────
function ConnectionBanner({ status }) {
  if (status !== 'disconnected') return null
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-xs text-center py-2 flex items-center justify-center gap-1.5">
      <WifiOff size={13} />
      실시간 연결이 끊겼습니다. 재연결 중…
    </div>
  )
}

// ── VotePage ──────────────────────────────────────────────────────
export default function VotePage() {
  const { roomId } = useParams()
  const navigate   = useNavigate()
  const showToast  = useToast()

  const { room, roomLoading, roomError } = useRoom(roomId)

  const [showNameModal, setShowNameModal]           = useState(false)
  const [showConfirmedModal, setShowConfirmedModal] = useState(false)
  const [selectedDates, setSelectedDates]           = useState(new Set())
  const [initDates, setInitDates]                   = useState(false)
  const [saving, setSaving]                         = useState(false)
  const [isEditMode, setIsEditMode]                 = useState(true)

  const {
    participants,
    loading: pLoading,
    participantId,
    isRestoringSession,
    registerParticipant,
  } = useParticipants(roomId)

  const { availabilities, connectionStatus, loading: vLoading, saveVotes } = useVotes(roomId)
  const { appointment, confirmDate, cancelAppointment } = useAppointment(roomId)

  // document.title
  useEffect(() => {
    if (room) {
      document.title = `${room.title || '모임'} 날짜 투표 | 날짜 맞춰`
    }
  }, [room])

  // 재연결 토스트
  const prevStatus = useRef('connecting')
  useEffect(() => {
    if (prevStatus.current === 'disconnected' && connectionStatus === 'connected') {
      showToast('🟢 연결되었습니다', 'success')
    }
    prevStatus.current = connectionStatus
  }, [connectionStatus, showToast])

  // 세션 복원 완료 후 모달 표시 여부
  useEffect(() => {
    if (isRestoringSession) return
    setShowNameModal(!participantId)
  }, [isRestoringSession, participantId])

  // 내 선택 날짜 초기화 (1회)
  useEffect(() => {
    if (initDates || vLoading || !participantId) return
    const my = availabilities.find(a => a.participant_id === participantId)
    setSelectedDates(new Set(my?.dates ?? []))
    setIsEditMode(!(my?.dates?.length > 0))
    setInitDates(true)
  }, [vLoading, participantId, availabilities, initDates])

  // ── 파생 데이터 ──────────────────────────────────────────────────
  const allowedDates = useMemo(() => {
    if (!room) return new Set()
    return new Set(datesInRange(room.date_from, room.date_to))
  }, [room])

  const heatmapData = useMemo(
    () => buildHeatmapData(allowedDates, availabilities, participants),
    [allowedDates, availabilities, participants]
  )

  const maxParticipants = room?.max_participants ?? 4

  const hasSubmitted = useMemo(() =>
    !!(participantId &&
      availabilities.some(a => a.participant_id === participantId && (a.dates?.length ?? 0) > 0)),
    [availabilities, participantId]
  )

  const myName = useMemo(
    () => participants.find(p => p.id === participantId)?.name ?? '',
    [participants, participantId]
  )

  // ── 핸들러 (useCallback으로 참조 안정화) ──────────────────────────
  const handleRegister = useCallback(async (name, pin) => {
    const wasExisting = participants.some(p => p.name === name)
    await registerParticipant(name, maxParticipants, pin)
    setInitDates(false)
    setShowNameModal(false)
    showToast(wasExisting ? `${name}으로 재입장했어요!` : `${name}으로 참여했어요! 🎉`, 'success')
  }, [participants, registerParticipant, maxParticipants, showToast])

  const handleDateToggle = useCallback((dateStr) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr)
      return next
    })
  }, [])

  const handleSaveVotes = useCallback(async () => {
    if (selectedDates.size === 0) {
      showToast('날짜를 1개 이상 선택해주세요', 'warning')
      return
    }
    if (!participantId) return
    setSaving(true)
    try {
      await saveVotes(participantId, [...selectedDates].sort())
      showToast('투표가 저장됐어요! 🎉', 'success')
      setIsEditMode(false)
    } catch {
      showToast('저장에 실패했어요. 다시 시도해주세요.', 'error')
    } finally {
      setSaving(false)
    }
  }, [selectedDates, participantId, saveVotes, showToast])

  const handleConfirm = useCallback(async (date) => {
    try {
      await confirmDate(date)
      showToast(`${formatDateLong(date)}로 확정됐어요! 🎉`, 'success')
      setShowConfirmedModal(true)
    } catch {
      showToast('확정에 실패했어요.', 'error')
    }
  }, [confirmDate, showToast])

  const handleCancelAppointment = useCallback(async () => {
    try {
      await cancelAppointment()
      showToast('확정이 취소됐어요.', 'info')
    } catch {
      showToast('취소에 실패했어요.', 'error')
    }
  }, [cancelAppointment, showToast])

  // ── 로딩 / 에러 상태 ─────────────────────────────────────────────
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

  // ── 렌더 ─────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen bg-gray-50 ${connectionStatus === 'disconnected' ? 'pt-8' : ''}`}>
      <ConnectionBanner status={connectionStatus} />

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
              <span className="text-xs text-gray-400 ml-2 truncate">
                {room.title} | {formatDateMedium(room.date_from)} ~ {formatDateMedium(room.date_to)}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {confirmedDate && (
                <button
                  onClick={() => navigate(`/confirmed/${roomId}`)}
                  className="text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 active:scale-95 px-2.5 py-1.5 rounded-full transition-all"
                >
                  ⭐ 확정 페이지
                </button>
              )}
              {myName && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {myName}
                </span>
              )}
            </div>
          </div>
        </header>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-5">
        <div className="lg:grid lg:grid-cols-[60%_40%] lg:gap-6">

          {/* 좌: 캘린더 카드 */}
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
                  <ParticipantBar
                    participants={participants}
                    availabilities={availabilities}
                    maxParticipants={maxParticipants}
                  />
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
                heatmapData={hasSubmitted ? heatmapData : null}
                isEditMode={isEditMode}
                confirmedDate={confirmedDate}
              />

              {hasSubmitted && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 flex-wrap">
                  <span className="text-xs text-gray-400">투표 인원</span>
                  <span className="text-xs text-gray-400">적음</span>
                  {HEAT_COLORS.slice(1).map((c, i) => (
                    <span key={i} className="w-4 h-4 rounded" style={{ backgroundColor: c }} />
                  ))}
                  <span className="text-xs text-gray-400">많음</span>
                </div>
              )}

              <button
                onClick={hasSubmitted && !isEditMode ? () => setIsEditMode(true) : handleSaveVotes}
                disabled={saving || !participantId}
                className="mt-4 w-full bg-green-500 text-white py-3 min-h-[48px] rounded-xl font-bold hover:bg-green-600 active:bg-green-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                {saving ? '저장 중…' : hasSubmitted && !isEditMode ? '날짜 변경' : hasSubmitted ? '변경 저장' : '투표하기'}
              </button>
              {hasSubmitted && (
                <p className="mt-1.5 text-xs text-center text-gray-400">
                  날짜를 다시 선택하고 저장하면 업데이트돼요
                </p>
              )}
            </div>
          </div>

          {/* 우: 순위 카드 */}
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
                maxParticipants={maxParticipants}
              />
            </div>
          </div>
        </div>
      </main>

      <NameModal
        isOpen={showNameModal}
        participants={participants}
        maxParticipants={maxParticipants}
        onSubmit={handleRegister}
      />

      <ConfirmedModal
        isOpen={showConfirmedModal}
        confirmedDate={confirmedDate}
        roomId={roomId}
        onClose={() => setShowConfirmedModal(false)}
      />
    </div>
  )
}
