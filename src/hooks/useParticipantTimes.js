import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useParticipantTimes(roomId) {
  const [times, setTimes]   = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTimes = useCallback(async () => {
    if (!roomId) return
    const { data, error } = await supabase
      .from('participant_times')
      .select('*, participants(id, name, color)')
      .eq('room_id', roomId)
    if (error) {
      console.error('[useParticipantTimes/fetchTimes]', error)
    } else {
      setTimes(data ?? [])
    }
    setLoading(false)
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
    const { error } = await supabase
      .from('participant_times')
      .upsert(
        { room_id: roomId, participant_id: participantId, start_time: startTime, end_time: endTime },
        { onConflict: 'room_id,participant_id' }
      )
    if (error) throw error
    await fetchTimes()
  }, [roomId, fetchTimes])

  return { times, loading, saveTime, refetch: fetchTimes }
}
