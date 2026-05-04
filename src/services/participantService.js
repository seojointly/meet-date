import { supabase } from '../lib/supabase'

const PARTICIPANT_FIELDS = 'id, name, color, created_at'

export async function fetchParticipants(roomId) {
  const { data, error } = await supabase
    .from('participants')
    .select(PARTICIPANT_FIELDS)
    .eq('room_id', roomId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createParticipant({ roomId, name, color, pin }) {
  const { data, error } = await supabase
    .from('participants')
    .insert({ room_id: roomId, name, color, pin: pin || null })
    .select(PARTICIPANT_FIELDS)
    .single()
  if (error) throw error
  return data
}

// 세션 복원 1단계: ID 존재 확인 — 에러 시 null 반환 (name 기반 복원으로 폴백)
export async function fetchParticipantById(id) {
  const { data } = await supabase
    .from('participants')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  return data ?? null
}

export async function fetchParticipantByName({ roomId, name }) {
  const { data, error } = await supabase
    .from('participants')
    .select('id, pin')
    .eq('room_id', roomId)
    .eq('name', name)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function checkExistingParticipant({ roomId, name }) {
  const { data } = await supabase
    .from('participants')
    .select('id')
    .eq('room_id', roomId)
    .eq('name', name)
    .maybeSingle()
  return data ? { exists: true } : { exists: false }
}

export async function verifyParticipantPin({ roomId, name, pin }) {
  const { data, error } = await supabase
    .from('participants')
    .select('id, pin')
    .eq('room_id', roomId)
    .eq('name', name)
    .single()
  if (error) throw error
  if (data.pin !== null && data.pin !== pin) {
    return { verified: false }
  }
  return { verified: true, participantId: data.id }
}

// 재입장 시 PIN 검증 — 불일치 시 code:'WRONG_PIN' 에러 throw
export async function verifyPin({ roomId, name, pin }) {
  const { data, error } = await supabase
    .from('participants')
    .select('id, pin')
    .eq('room_id', roomId)
    .eq('name', name)
    .single()
  if (error) throw error
  if (data.pin !== null && data.pin !== pin) {
    throw Object.assign(new Error('PIN이 올바르지 않아요'), { code: 'WRONG_PIN' })
  }
  return data
}
