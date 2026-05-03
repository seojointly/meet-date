import { MAX_PARTICIPANTS } from '../hooks/useParticipants'

export default function ParticipantBar({ participants, availabilities }) {
  const emptySlots = MAX_PARTICIPANTS - participants.length

  function hasSubmitted(p) {
    const avail = availabilities.find(a => a.participant_id === p.id)
    return avail ? avail.dates.length > 0 : false
  }

  return (
    <div className="flex items-center gap-3 flex-nowrap overflow-x-auto pb-1 scrollbar-hide">
      {participants.map(p => (
        <div key={p.id} className="flex flex-col items-center gap-0.5 shrink-0">
          <div className="relative">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ backgroundColor: p.color }}
            >
              {p.name.charAt(0)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">
              {hasSubmitted(p) ? '✅' : '⏳'}
            </span>
          </div>
          <span className="text-xs text-gray-500 max-w-[36px] truncate">{p.name}</span>
        </div>
      ))}

      {Array.from({ length: emptySlots }).map((_, i) => (
        <div key={`empty-${i}`} className="flex flex-col items-center gap-0.5 shrink-0">
          <div className="w-9 h-9 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
            <span className="text-gray-300 text-lg leading-none">+</span>
          </div>
          <span className="text-xs text-gray-300">빈자리</span>
        </div>
      ))}

      <span className="text-xs text-gray-400 ml-1 self-start pt-1 shrink-0">
        {participants.length}/{MAX_PARTICIPANTS}명
      </span>
    </div>
  )
}
