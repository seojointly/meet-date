import { useState, useEffect, useRef } from 'react'
import { Users } from 'lucide-react'
import { validatePin } from '../domain/participant'
import { checkExistingParticipant, verifyParticipantPin } from '../services/participantService'

export default function NameModal({ isOpen, roomId, participants, maxParticipants, onRegisterNew, onRestore }) {
  const [name, setName]         = useState('')
  const [pin, setPin]           = useState('')
  const [pinError, setPinError] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [step, setStep]         = useState('name') // 'name' | 'existing_pin' | 'new_pin' | 'full'
  const inputRef = useRef(null)

  const trimmedName = name.trim()

  useEffect(() => {
    if (isOpen) {
      setName('')
      setPin('')
      setPinError('')
      setError('')
      setLoading(false)
      setStep('name')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  async function handleNameSubmit(e) {
    e.preventDefault()
    if (!trimmedName) { setError('이름을 입력해주세요'); return }

    setLoading(true)
    setError('')
    try {
      const { exists } = await checkExistingParticipant({ roomId, name: trimmedName })
      if (exists) {
        setStep('existing_pin')
        setPin('')
        setPinError('')
      } else if (participants.length >= maxParticipants) {
        setStep('full')
      } else {
        setStep('new_pin')
        setPin('')
        setPinError('')
      }
    } catch {
      setError('오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleExistingPinSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setPinError('')
    try {
      const result = await verifyParticipantPin({ roomId, name: trimmedName, pin: pin || null })
      if (result.verified) {
        await onRestore(result.participantId, trimmedName, pin || null)
      } else {
        setPinError('PIN이 올바르지 않아요')
      }
    } catch {
      setPinError('오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleNewPinSubmit(e) {
    e.preventDefault()
    if (pin && !validatePin(pin)) { setPinError('숫자 4자리를 입력해주세요'); return }

    setLoading(true)
    setPinError('')
    setError('')
    try {
      await onRegisterNew(trimmedName, pin || null)
    } catch (err) {
      setError(err.message ?? '오류가 발생했습니다')
    } finally {
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

        {/* Step: 이름 입력 */}
        {step === 'name' && (
          <form onSubmit={handleNameSubmit} noValidate>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
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

            {participants.length > 0 && (
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
              {loading ? '확인 중…' : '확인'}
            </button>
          </form>
        )}

        {/* Step: 기존 참여자 PIN 입력 */}
        {step === 'existing_pin' && (
          <form onSubmit={handleExistingPinSubmit} noValidate>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm font-medium text-yellow-800">{trimmedName}님, 반가워요!</p>
              <p className="text-xs text-yellow-700 mt-0.5">PIN을 입력하면 재입장할 수 있어요</p>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN</label>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
              placeholder="숫자 4자리 (PIN 없으면 빈칸)"
              maxLength={4}
              autoComplete="off"
              className={[
                'w-full px-3 py-2.5 border rounded-xl text-sm',
                'focus:outline-none focus:ring-2 focus:ring-yellow-400',
                pinError ? 'border-red-400 bg-red-50' : 'border-yellow-300',
              ].join(' ')}
            />
            {pinError && <p className="text-red-500 text-xs mt-1.5">{pinError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full bg-green-500 text-white py-3 min-h-[48px] rounded-xl font-semibold hover:bg-green-600 active:bg-green-700 active:scale-95 disabled:opacity-60 transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              {loading ? '처리 중…' : '재입장하기'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('name'); setPin(''); setPinError('') }}
              className="mt-2 w-full text-sm text-gray-500 py-2 hover:text-gray-700"
            >
              이름 다시 입력
            </button>
          </form>
        )}

        {/* Step: 신규 참여자 PIN 설정 */}
        {step === 'new_pin' && (
          <form onSubmit={handleNewPinSubmit} noValidate>
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-xs font-medium text-gray-600 mb-0.5">PIN 설정 (선택)</p>
              <p className="text-xs text-gray-400">PIN을 설정하면 다음에 같은 이름으로 재입장할 수 있어요</p>
            </div>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
              placeholder="숫자 4자리 (선택사항)"
              maxLength={4}
              autoComplete="off"
              className={[
                'w-full px-3 py-2.5 border rounded-xl text-sm',
                'focus:outline-none focus:ring-2 focus:ring-green-500',
                pinError ? 'border-red-400 bg-red-50' : 'border-gray-300',
              ].join(' ')}
            />
            {pinError && <p className="text-red-500 text-xs mt-1.5">{pinError}</p>}
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full bg-green-500 text-white py-3 min-h-[48px] rounded-xl font-semibold hover:bg-green-600 active:bg-green-700 active:scale-95 disabled:opacity-60 transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              {loading ? '처리 중…' : '투표 시작하기'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('name'); setPin(''); setPinError('') }}
              className="mt-2 w-full text-sm text-gray-500 py-2 hover:text-gray-700"
            >
              이름 다시 입력
            </button>
          </form>
        )}

        {/* Step: 정원 초과 */}
        {step === 'full' && (
          <div className="text-center py-6 space-y-2">
            <p className="text-3xl">🙅</p>
            <p className="font-semibold text-gray-800">
              정원이 가득 찼습니다 ({maxParticipants}/{maxParticipants})
            </p>
            <p className="text-sm text-gray-500">이 방에는 더 이상 참여할 수 없어요.</p>
            <button
              type="button"
              onClick={() => setStep('name')}
              className="mt-3 text-sm text-green-600 underline"
            >
              다른 이름으로 시도
            </button>
          </div>
        )}
      </div>
    </>
  )
}
