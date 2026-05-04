import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchAppointment as fetchAppointmentService,
  confirmDate as confirmDateService,
  cancelAppointment as cancelAppointmentService,
  saveMemo as saveMemoService,
} from '../services/appointmentService'

export function useAppointment(roomId) {
  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading]         = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const fetchAppointment = useCallback(async () => {
    if (!roomId) return
    try {
      const data = await fetchAppointmentService(roomId)
      if (!mounted.current) return
      setAppointment(data)
      setLoading(false)
    } catch (err) {
      if (!mounted.current) return
      console.error('[useAppointment/fetchAppointment]', err)
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => { fetchAppointment() }, [fetchAppointment])

  useEffect(() => {
    if (!roomId) return
    const ch = supabase
      .channel(`appt-${roomId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'appointments',
        filter: `room_id=eq.${roomId}`,
      }, () => fetchAppointment())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId, fetchAppointment])

  const confirmDate = useCallback(async (date) => {
    await confirmDateService({ roomId, date })
    await fetchAppointment()
  }, [roomId, fetchAppointment])

  const cancelAppointment = useCallback(async () => {
    await cancelAppointmentService(roomId)
    if (mounted.current) setAppointment(null)
  }, [roomId])

  const saveMemo = useCallback(async (memo) => {
    await saveMemoService({ roomId, memo })
    await fetchAppointment()
  }, [roomId, fetchAppointment])

  return { appointment, loading, confirmDate, cancelAppointment, saveMemo }
}
