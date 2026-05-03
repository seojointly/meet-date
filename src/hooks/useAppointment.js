import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAppointment(roomId) {
  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAppointment = useCallback(async () => {
    if (!roomId) return
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle()
    if (!error) setAppointment(data ?? null)
    setLoading(false)
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
    const { error } = await supabase
      .from('appointments')
      .upsert({ room_id: roomId, confirmed_date: date }, { onConflict: 'room_id' })
    if (error) throw error
    await fetchAppointment()
  }, [roomId, fetchAppointment])

  const cancelAppointment = useCallback(async () => {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('room_id', roomId)
    if (error) throw error
    setAppointment(null)
  }, [roomId])

  const saveMemo = useCallback(async (memo) => {
    const { error } = await supabase
      .from('appointments')
      .update({ memo })
      .eq('room_id', roomId)
    if (error) throw error
    await fetchAppointment()
  }, [roomId, fetchAppointment])

  return { appointment, loading, confirmDate, cancelAppointment, saveMemo }
}
