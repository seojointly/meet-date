import { supabase } from '../lib/supabase'

export async function fetchAppointment(roomId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, room_id, confirmed_date, memo')
    .eq('room_id', roomId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function confirmDate({ roomId, date }) {
  const { error } = await supabase
    .from('appointments')
    .upsert({ room_id: roomId, confirmed_date: date }, { onConflict: 'room_id' })
  if (error) throw error
}

export async function cancelAppointment(roomId) {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('room_id', roomId)
  if (error) throw error
}

export async function saveMemo({ roomId, memo }) {
  const { error } = await supabase
    .from('appointments')
    .update({ memo })
    .eq('room_id', roomId)
  if (error) throw error
}
