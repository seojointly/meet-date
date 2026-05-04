import { supabase } from '../lib/supabase'

export async function fetchRoom(roomId) {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, title, date_from, date_to, max_participants')
    .eq('id', roomId)
    .single()
  if (error) throw error
  return data
}

export async function createRoom({ title, dateFrom, dateTo, maxParticipants }) {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      title,
      date_from: dateFrom,
      date_to: dateTo,
      max_participants: maxParticipants,
    })
    .select('id')
    .single()
  if (error) throw error
  return data
}
