import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { PARTICIPANT_COLORS } from '../constants/colors'

const storageKey = (roomId) => `participant_${roomId}`

// pin은 클라이언트 상태에 노출하지 않음 — 검증은 별도 쿼리로 수행
const PARTICIPANT_FIELDS = 'id, room_id, name, color, created_at'

export function useParticipants(roomId) {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [participantId, setParticipantId] = useState(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  const fetchParticipants = useCallback(async () => {
    if (!roomId) return
    const { data, error } = await supabase
      .from('participants')
      .select(PARTICIPANT_FIELDS)
      .eq('room_id', roomId)
      .order('created_at')
    if (error) {
      console.error('[useParticipants/fetchParticipants]', error)
    } else {
      setParticipants(data ?? [])
    }
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    let cancelled = false

    const restoreSession = async () => {
      setIsRestoringSession(true)
      try {
        const stored = localStorage.getItem(storageKey(roomId))
        if (stored) {
          const { id, name, pin } = JSON.parse(stored)
          const storedPin = pin ?? null

          // 1. id로 복원 시도
          const { data, error } = await supabase
            .from('participants')
            .select('id')
            .eq('id', id)
            .maybeSingle()

          if (cancelled) return

          if (!error && data) {
            setParticipantId(id)
          } else if (name) {
            // 2. name + room_id로 복원 시도
            const { data: nameData, error: nameError } = await supabase
              .from('participants')
              .select('id, pin')
              .eq('room_id', roomId)
              .eq('name', name)
              .maybeSingle()

            if (cancelled) return

            if (!nameError && nameData) {
              if (nameData.pin === null || nameData.pin === storedPin) {
                setParticipantId(nameData.id)
                localStorage.setItem(storageKey(roomId), JSON.stringify({ id: nameData.id, name, pin: storedPin }))
              } else {
                localStorage.removeItem(storageKey(roomId))
              }
            } else {
              localStorage.removeItem(storageKey(roomId))
            }
          } else {
            localStorage.removeItem(storageKey(roomId))
          }
        }
      } catch {
        localStorage.removeItem(storageKey(roomId))
      } finally {
        if (!cancelled) setIsRestoringSession(false)
      }
    }

    restoreSession()
    return () => { cancelled = true }
  }, [roomId])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  useEffect(() => {
    if (!roomId) return
    const ch = supabase
      .channel(`participants-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `room_id=eq.${roomId}`,
      }, () => fetchParticipants())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId, fetchParticipants])

  const registerParticipant = useCallback(async (name, maxParticipants, pin = null) => {
    const existing = participants.find(p => p.name === name)

    if (existing) {
      // 재입장: PIN 검증 (participants state에 pin이 없으므로 별도 조회)
      const { data: pData, error: pError } = await supabase
        .from('participants')
        .select('id, pin')
        .eq('id', existing.id)
        .single()
      if (pError) throw pError

      if (pData.pin !== null && pData.pin !== pin) {
        throw Object.assign(new Error('PIN이 올바르지 않아요'), { code: 'WRONG_PIN' })
      }

      localStorage.setItem(storageKey(roomId), JSON.stringify({ id: existing.id, name, pin: pin ?? null }))
      setParticipantId(existing.id)
      return existing
    }

    // 신규 참여자
    if (participants.length >= maxParticipants) {
      throw Object.assign(
        new Error(`정원이 가득 찼습니다 (${participants.length}/${maxParticipants})`),
        { code: 'FULL' }
      )
    }

    const color = PARTICIPANT_COLORS[participants.length % PARTICIPANT_COLORS.length]
    const { data, error } = await supabase
      .from('participants')
      .insert({ room_id: roomId, name, color, pin: pin || null })
      .select(PARTICIPANT_FIELDS)
      .single()
    if (error) {
      if (error.code === '23505') {
        throw Object.assign(new Error('이미 사용 중인 이름입니다'), { code: 'DUPLICATE' })
      }
      throw error
    }
    localStorage.setItem(storageKey(roomId), JSON.stringify({ id: data.id, name: data.name, pin: pin ?? null }))
    setParticipantId(data.id)
    await fetchParticipants()
    return data
  }, [roomId, participants, fetchParticipants])

  return {
    participants,
    loading,
    participantId,
    isRestoringSession,
    registerParticipant,
    refetch: fetchParticipants,
  }
}
