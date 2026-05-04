import { supabase } from '../lib/supabase'

export async function fetchAvailabilities(roomId) {
  const { data, error } = await supabase
    .from('availabilities')
    .select('id, participant_id, dates, participants(id, name, color)')
    .eq('room_id', roomId)
  if (error) throw error
  return data ?? []
}

export async function saveAvailability({ participantId, roomId, dates }) {
  const { error } = await supabase
    .from('availabilities')
    .upsert(
      { participant_id: participantId, room_id: roomId, dates },
      { onConflict: 'participant_id' }
    )
  if (error) throw error
}
