import { memo, useMemo } from 'react'
import { CheckCircle, RefreshCw } from 'lucide-react'
import { formatDateLong } from '../domain/date'
import { buildRanking } from '../domain/vote'

const MEDAL = ['🥇', '🥈', '🥉']

function RankingList({
  allowedDates,
  availabilities,
  participants,
  confirmedDate,
  onConfirm,
  onCancel,
  maxParticipants,
}) {
  const ranked = useMemo(
    () => allowedDates ? buildRanking(allowedDates, availabilities) : [],
    [allowedDates, availabilities]
  )

  const total = participants.length

  if (total === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">아직 참여자가 없어요.</p>
  }

  if (ranked.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">아직 투표한 사람이 없어요.</p>
  }

  let rankNum = 1
  const items = ranked.map(([date, voters], i) => {
    if (i > 0 && voters.length < ranked[i - 1][1].length) rankNum = i + 1
    const curRank      = rankNum
    const isConfirmed  = date === confirmedDate
    const allAvailable = voters.length >= maxParticipants
    return { date, voters, curRank, isConfirmed, allAvailable }
  })

  return (
    <div className="space-y-2">
      {items.map(({ date, voters, curRank, isConfirmed, allAvailable }) => (
        <div
          key={date}
          className={[
            'flex items-center gap-3 p-4 rounded-xl border transition-all duration-300',
            isConfirmed
              ? 'border-yellow-300 bg-yellow-50'
              : allAvailable
                ? 'border-green-200 bg-green-50'
                : 'border-gray-100 bg-white',
          ].join(' ')}
        >
          <span className="text-xl shrink-0 w-7 text-center">
            {curRank <= 3
              ? MEDAL[curRank - 1]
              : <span className="text-sm text-gray-500">{curRank}</span>}
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {isConfirmed && <span className="mr-1">⭐</span>}
              {formatDateLong(date)}
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {voters.map(v => (
                <span
                  key={v.name}
                  className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: v.color }}
                >
                  {v.name}
                </span>
              ))}
            </div>
            {allAvailable && (
              <span className="inline-block mt-1.5 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                🎉 모두 가능!
              </span>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-xs font-bold text-gray-600">
              {voters.length}/{maxParticipants}명
            </span>
            {isConfirmed ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 px-2.5 py-1 rounded-full">
                <CheckCircle size={12} />
                확정됨
              </span>
            ) : confirmedDate ? (
              <button
                onClick={() => onConfirm(date)}
                className="text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 active:scale-95 px-2.5 py-1 rounded-full transition-all flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1"
              >
                <RefreshCw size={11} />
                재확정
              </button>
            ) : (
              <button
                onClick={() => onConfirm(date)}
                className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 active:scale-95 px-2.5 py-1 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
              >
                이 날로 확정
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default memo(RankingList)
