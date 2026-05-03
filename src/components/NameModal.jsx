import { useState, useEffect, useRef } from 'react'
import { Users } from 'lucide-react'

export default function NameModal({ isOpen, participants, maxParticipants, onSubmit }) {
  const [name, setName]         = useState('')
  const [pin, setPin]           = useState('')
  const [pinError, setPinError] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const inputRef = useRef(null)

  const trimmedName = name.trim()
  const isExisting  = !!trimmedName && participants.some(p => p.name === trimmedName)
  const isFull      = participants.length >= maxParticipants

  useEffect(() => {
    if (isOpen) {
      setName('')
      setPin('')
      setPinError('')
      setError('')
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!trimmedName) { setError('이름을 입력해주세요'); return }
    if (pin && !/^\d{4}$/.test(pin)) { setPinError('숫자 4자리를 입력해주세요'); return }

    setLoading(true)
    setError('')
    setPinError('')
    try {
      await onSubmit(trimmedName, pin || null)
    } catch (err) {
      if (err.code === 'WRONG_PIN') {
        setPinError(err.message)
      } else {
        setError(err.message ?? '오류가 발생했습니다')
      }
      setLoading(false)
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <div
        className={[
          'fixed z-[70] bg-white shadow-2xl',
          'bottom-0 left-0 right-0 rounded-t-2xl',
          'md:top-1/2 md:left-1/2 md:bottom-auto md:right-auto',
          'md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:w-96',
          'p-6 transition-all duration-300',
          isOpen
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 md:translate-y-[-40%] pointer-events-none',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-modal-title"
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 md:hidden" />

        <div className="flex items-center gap-2 mb-1">
          <Users size={20} className="text-green-500" />
          <h2 id="name-modal-title" className="text-lg font-bold">참여자 이름 입력</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">이름은 투표 결과에 표시됩니다.</p>

        {isFull && !isExisting ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-3xl">🙅</p>
            <p className="font-semibold text-gray-800">
              정원이 가득 찼습니다 ({maxParticipants}/{maxParticipants})
            </p>
            <p className="text-sm text-gray-500">이 방에는 더 이상 참여할 수 없어요.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* 이름 입력 */}
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); setPinError('') }}
              placeholder="예) 홍길동"
              maxLength={20}
              autoComplete="off"
              className={[
                'w-full px-3 py-2.5 border rounded-xl text-sm',
                'focus:outline-none focus:ring-2 focus:ring-green-500',
                error ? 'border-red-400 bg-red-50' : 'border-gray-300',
              ].join(' ')}
            />
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}

            {/* 케이스 B — 기존 참여자 재입장 */}
            {isExisting && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-sm text-yellow-800 mb-2">
                  이미 있는 이름이에요. PIN을 입력하면 재입장할 수 있어요
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
                  placeholder="숫자 4자리 (PIN 없으면 빈칸)"
                  maxLength={4}
                  className={[
                    'w-full px-3 py-2.5 border rounded-xl text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-yellow-400',
                    pinError ? 'border-red-400 bg-red-50' : 'border-yellow-300',
                  ].join(' ')}
                />
                {pinError && <p className="text-red-500 text-xs mt-1.5">{pinError}</p>}
              </div>
            )}

            {/* 케이스 A — 새 참여자 선택적 PIN 설정 */}
            {!isExisting && trimmedName && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-xs font-medium text-gray-600 mb-0.5">PIN 설정 (선택)</p>
                <p className="text-xs text-gray-400 mb-2">
                  PIN을 설정하면 다음에 같은 이름으로 재입장할 수 있어요
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
                  placeholder="숫자 4자리 (선택사항)"
                  maxLength={4}
                  className={[
                    'w-full px-3 py-2.5 border rounded-xl text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-green-500',
                    pinError ? 'border-red-400 bg-red-50' : 'border-gray-300',
                  ].join(' ')}
                />
                {pinError && <p className="text-red-500 text-xs mt-1.5">{pinError}</p>}
              </div>
            )}

            {/* 기존 참여자 배지 */}
            {!isExisting && participants.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {participants.map(p => (
                  <span
                    key={p.id}
                    className="text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name}
                  </span>
                ))}
                <span className="text-xs text-gray-400">이미 참여 중</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full bg-green-500 text-white py-3 min-h-[48px] rounded-xl font-semibold hover:bg-green-600 active:bg-green-700 active:scale-95 disabled:opacity-60 transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              {loading ? '처리 중…' : isExisting ? '재입장하기' : '투표 시작하기'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
