import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useVotes(roomId) {
  const [availabilities, setAvailabilities] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const fetchAvailabilities = useCallback(async () => {
    if (!roomId) return
    const { data, error } = await supabase
      .from('availabilities')
      .select('id, participant_id, dates, participants(id, name, color)')
      .eq('room_id', roomId)
    if (error) {
      console.error('[useVotes/fetchAvailabilities]', error)
    } else {
      setAvailabilities(data ?? [])
    }
    setLoading(false)
  }, [roomId])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(fetchAvailabilities, 5000)
  }, [fetchAvailabilities])

  const stopPolling = useCallback(() => {
    clearInterval(pollRef.current)
    pollRef.current = null
  }, [])

  useEffect(() => {
    fetchAvailabilities()
  }, [fetchAvailabilities])

  useEffect(() => {
    if (!roomId) return
    const ch = supabase
      .channel(`avail-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availabilities', filter: `room_id=eq.${roomId}` },
        () => fetchAvailabilities()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
          stopPolling()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnectionStatus('disconnected')
          startPolling()
        }
      })
    return () => {
      stopPolling()
      supabase.removeChannel(ch)
    }
  }, [roomId, fetchAvailabilities, startPolling, stopPolling])

  const saveVotes = useCallback(async (participantId, dates) => {
    const { error } = await supabase
      .from('availabilities')
      .upsert({ participant_id: participantId, room_id: roomId, dates }, { onConflict: 'participant_id' })
    if (error) throw error
    await fetchAvailabilities()
  }, [roomId, fetchAvailabilities])

  return { availabilities, connectionStatus, loading, saveVotes, refetch: fetchAvailabilities }
}
