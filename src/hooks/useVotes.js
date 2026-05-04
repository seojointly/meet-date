import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAvailabilities as fetchAvailabilitiesService, saveAvailability } from '../services/voteService'

export function useVotes(roomId) {
  const [availabilities, setAvailabilities] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const fetchAvailabilities = useCallback(async () => {
    if (!roomId) return
    try {
      const data = await fetchAvailabilitiesService(roomId)
      if (!mounted.current) return
      setAvailabilities(data)
      setLoading(false)
    } catch (err) {
      if (!mounted.current) return
      console.error('[useVotes/fetchAvailabilities]', err)
      setLoading(false)
    }
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
    await saveAvailability({ participantId, roomId, dates })
    await fetchAvailabilities()
  }, [roomId, fetchAvailabilities])

  return { availabilities, connectionStatus, loading, saveVotes, refetch: fetchAvailabilities }
}
