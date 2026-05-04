import { supabase } from '../lib/supabase'

export async function fetchParticipantTimes(roomId) {
  const { data, error } = await supabase
    .from('participant_times')
    .select('participant_id, room_id, start_time, end_time, participants(id, name, color)')
    .eq('room_id', roomId)
  if (error) throw error
  return data ?? []
}

export async function saveParticipantTime({ roomId, participantId, startTime, endTime }) {
  const { error } = await supabase
    .from('participant_times')
    .upsert(
      { room_id: roomId, participant_id: participantId, start_time: startTime, end_time: endTime },
      { onConflict: 'room_id,participant_id' }
    )
  if (error) throw error
}
