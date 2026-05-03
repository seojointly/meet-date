import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useParticipants } from '../hooks/useParticipants'
import { useAppointment } from '../hooks/useAppointment'
import { useParticipantTimes } from '../hooks/useParticipantTimes'
import { useRoom } from '../hooks/useRoom'
import { formatDateFull } from '../utils/date'

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${period} ${hour}시` : `${period} ${hour}시 ${m}분`
}

export default function ConfirmedPage() {
  const { roomId } = useParams()
  const navigate   = useNavigate()
  const showToast  = useToast()

  const { room, roomLoading } = useRoom(roomId)

  const [memo, setMemo]               = useState('')
  const [savingMemo, setSavingMemo]   = useState(false)
  const [myStartTime, setMyStartTime] = useState('')
  const [myEndTime, setMyEndTime]     = useState('')
  const [savingTime, setSavingTime]   = useState(false)

  const { participants, participantId, isRestoringSession } = useParticipants(roomId)
  const { appointment, loading: aLoading, saveMemo: saveAppointmentMemo } = useAppointment(roomId)
  const { times, saveTime } = useParticipantTimes(roomId)

  // document.title 설정
  useEffect(() => {
    if (room) {
      document.title = `${room.title || '모임'} 확정 | 날짜 맞춰`
    }
  }, [room])

  // 메모 초기화 — 1회만 실행하여 사용자 입력 중 덮어쓰기 방지
  const memoInitialized = useRef(false)
  useEffect(() => {
    if (!memoInitialized.current && appointment?.memo !== undefined) {
      setMemo(appointment.memo ?? '')
      memoInitialized.current = true
    }
  }, [appointment])

  // 내 시간 동기화
  useEffect(() => {
    if (!participantId) return
    const toHHMM = (t) => t ? t.slice(0, 5) : ''
    const pt = times.find(pt => pt.participant_id === participantId)
    if (pt?.start_time) setMyStartTime(toHHMM(pt.start_time))
    if (pt?.end_time) setMyEndTime(toHHMM(pt.end_time))
  }, [times, participantId])

  // 전원 시간 제출 여부 + 겹치는 시간 계산
  const { allSubmitted, overlapResult } = useMemo(() => {
    if (participants.length === 0) return { allSubmitted: false, overlapResult: null }
    const allSubmitted = participants.every(p =>
      times.some(t => t.participant_id === p.id && t.start_time && t.end_time)
    )
    if (!allSubmitted) return { allSubmitted: false, overlapResult: null }
    const starts = participants.map(p =>
      times.find(t => t.participant_id === p.id)?.start_time
    ).filter(Boolean)
    const ends = participants.map(p =>
      times.find(t => t.participant_id === p.id)?.end_time
    ).filter(Boolean)
    const maxStart = starts.reduce((a, b) => a > b ? a : b)
    const minEnd   = ends.reduce((a, b) => a < b ? a : b)
    return {
      allSubmitted: true,
      overlapResult: maxStart < minEnd ? { start: maxStart, end: minEnd } : null,
    }
  }, [participants, times])

  async function handleSaveTime() {
    if (!participantId || !myStartTime || !myEndTime) return
    if (myStartTime >= myEndTime) {
      showToast('종료 시간이 시작 시간보다 늦어야 해요', 'warning')
      return
    }
    setSavingTime(true)
    try {
      await saveTime(participantId, myStartTime, myEndTime)
      showToast('시간이 저장됐어요!', 'success')
    } catch {
      showToast('저장에 실패했어요.', 'error')
    } finally {
      setSavingTime(false)
    }
  }

  async function handleSaveMemo() {
    setSavingMemo(true)
    try {
      await saveAppointmentMemo(memo)
      showToast('메모가 저장됐어요!', 'success')
    } catch {
      showToast('저장에 실패했어요.', 'error')
    } finally {
      setSavingMemo(false)
    }
  }

  // 로딩
  if (roomLoading || isRestoringSession || aLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const confirmedDate = appointment?.confirmed_date ?? null

  // 확정 날짜 없으면 안내
  if (!confirmedDate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center bg-gray-50">
        <span className="text-5xl">📅</span>
        <p className="font-semibold text-gray-800">아직 날짜가 확정되지 않았어요.</p>
        <button
          onClick={() => navigate(`/vote/${roomId}`)}
          className="text-green-600 underline text-sm"
        >
          투표 페이지로 이동
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="sticky top-0 z-40">
        <header className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-2">
            <CalendarDays size={20} className="text-green-600" />
            <Link
              to="/"
              className="font-bold text-gray-800 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded"
            >
              날짜 맞춰
            </Link>
            {room && (
              <span className="text-xs text-gray-400 ml-2 truncate">{room.title}</span>
            )}
          </div>
        </header>
      </div>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* 확정 날짜 배너 */}
        <div className="bg-green-500 rounded-2xl p-5 text-white text-center shadow-sm">
          <p className="text-xl font-bold">⭐ {formatDateFull(confirmedDate)} 확정!</p>
        </div>

        {/* 시간 선택 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-0.5">⏰ 만나는 시간</h2>
          <p className="text-xs text-gray-400 mb-4">각자 가능한 시작~종료 시간을 선택해주세요</p>

          {participants.length > 0 && !allSubmitted && (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl text-center">
              <p className="text-sm text-gray-500">아직 모든 인원이 시간을 입력하지 않았어요</p>
            </div>
          )}

          {allSubmitted && (
            <div className="mb-4 p-3 bg-green-50 rounded-xl text-center">
              {overlapResult ? (
                <>
                  <p className="text-sm font-semibold text-green-700">⏰ 모두 가능한 시간</p>
                  <p className="text-base font-bold text-green-800 mt-1">
                    {formatTime(overlapResult.start)} ~ {formatTime(overlapResult.end)}
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">({participants.length}명 모두 가능)</p>
                </>
              ) : (
                <p className="text-sm font-semibold text-red-500">
                  겹치는 시간대가 없어요 😢
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {participants.map(p => {
              const isMe      = p.id === participantId
              const saved     = times.find(t => t.participant_id === p.id)
              const savedStart = saved?.start_time ? saved.start_time.slice(0, 5) : null
              const savedEnd   = saved?.end_time   ? saved.end_time.slice(0, 5)   : null
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isMe ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-800">{p.name}</span>
                    {!isMe && (
                      <span className="text-sm text-gray-500 shrink-0">
                        {savedStart && savedEnd
                          ? `${formatTime(savedStart)} ~ ${formatTime(savedEnd)}`
                          : '미입력'}
                      </span>
                    )}
                  </div>
                  {isMe && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 shrink-0">가능 시작</span>
                        <input
                          type="time"
                          value={myStartTime}
                          onChange={e => setMyStartTime(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 shrink-0">가능 종료</span>
                        <input
                          type="time"
                          value={myEndTime}
                          onChange={e => setMyEndTime(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {participantId && (
            <button
              onClick={handleSaveTime}
              disabled={!myStartTime || !myEndTime || savingTime}
              className="mt-3 w-full bg-green-500 text-white py-2.5 min-h-[44px] rounded-xl font-semibold text-sm hover:bg-green-600 active:bg-green-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              {savingTime ? '저장 중…' : '시간 저장'}
            </button>
          )}
        </div>

        {/* 메모 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-0.5">📝 메모</h2>
          <p className="text-xs text-gray-400 mb-3">모임에 대한 공유 메모를 남겨보세요</p>
          <div className="relative">
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="장소, 준비물 등 자유롭게 메모하세요"
              maxLength={200}
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            <span className="absolute bottom-2.5 right-3 text-xs text-gray-400">
              {memo.length} / 200
            </span>
          </div>
          <button
            onClick={handleSaveMemo}
            disabled={savingMemo}
            className="mt-2 w-full bg-gray-800 text-white py-2.5 min-h-[44px] rounded-xl font-semibold text-sm hover:bg-gray-700 active:bg-gray-900 active:scale-95 disabled:opacity-50 transition-all focus-visible:ring-2 focus-visible:ring-gray-600 focus-visible:ring-offset-2"
          >
            {savingMemo ? '저장 중…' : '메모 저장'}
          </button>
        </div>
      </main>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => navigate(`/vote/${roomId}`)}
            className="w-full bg-gray-800 text-white py-3 min-h-[48px] rounded-xl font-bold hover:bg-gray-700 active:bg-gray-900 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-gray-600 focus-visible:ring-offset-2"
          >
            📊 투표 현황 보기
          </button>
        </div>
      </div>
    </div>
  )
}
