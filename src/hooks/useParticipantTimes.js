import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchParticipantTimes as fetchTimesService, saveParticipantTime } from '../services/timeService'

export function useParticipantTimes(roomId) {
  const [times, setTimes]     = useState([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const fetchTimes = useCallback(async () => {
    if (!roomId) return
    try {
      const data = await fetchTimesService(roomId)
      if (!mounted.current) return
      setTimes(data)
      setLoading(false)
    } catch (err) {
      if (!mounted.current) return
      console.error('[useParticipantTimes/fetchTimes]', err)
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => { fetchTimes() }, [fetchTimes])

  useEffect(() => {
    if (!roomId) return
    const ch = supabase
      .channel(`times-${roomId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'participant_times',
        filter: `room_id=eq.${roomId}`,
      }, () => fetchTimes())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId, fetchTimes])

  const saveTime = useCallback(async (participantId, startTime, endTime) => {
    await saveParticipantTime({ roomId, participantId, startTime, endTime })
    await fetchTimes()
  }, [roomId, fetchTimes])

  return { times, loading, saveTime, refetch: fetchTimes }
}
