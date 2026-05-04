import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { assignColor, isRoomFull } from '../domain/participant'
import {
  fetchParticipants as fetchParticipantsService,
  createParticipant,
  fetchParticipantById,
  fetchParticipantByName,
} from '../services/participantService'

const storageKey = (roomId) => `participant_${roomId}`

export function useParticipants(roomId) {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [participantId, setParticipantId] = useState(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const fetchParticipants = useCallback(async () => {
    if (!roomId) return
    try {
      const data = await fetchParticipantsService(roomId)
      if (!mounted.current) return
      setParticipants(data)
      setLoading(false)
    } catch (err) {
      if (!mounted.current) return
      console.error('[useParticipants/fetchParticipants]', err)
      setLoading(false)
    }
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

          // 1. id로 복원 시도 — 실패 시 null 반환 (에러 무시하고 name으로 폴백)
          const byId = await fetchParticipantById(id)

          if (cancelled) return

          if (byId) {
            setParticipantId(id)
          } else if (name) {
            // 2. name + room_id로 복원 시도
            const byName = await fetchParticipantByName({ roomId, name })

            if (cancelled) return

            if (byName) {
              if (byName.pin === null || byName.pin === storedPin) {
                setParticipantId(byName.id)
                localStorage.setItem(storageKey(roomId), JSON.stringify({ id: byName.id, name, pin: storedPin }))
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

  const registerNewParticipant = useCallback(async (name, pin, maxParticipants) => {
    if (isRoomFull(participants, maxParticipants)) {
      throw Object.assign(
        new Error(`정원이 가득 찼습니다 (${participants.length}/${maxParticipants})`),
        { code: 'FULL' }
      )
    }
    const color = assignColor(participants.length)
    try {
      const data = await createParticipant({ roomId, name, color, pin })
      localStorage.setItem(storageKey(roomId), JSON.stringify({ id: data.id, name: data.name, pin: pin ?? null }))
      setParticipantId(data.id)
      await fetchParticipants()
      return data
    } catch (err) {
      if (err.code === '23505') {
        throw Object.assign(new Error('이미 사용 중인 이름입니다'), { code: 'DUPLICATE' })
      }
      throw err
    }
  }, [roomId, participants, fetchParticipants])

  const restoreParticipant = useCallback(async (id, name, pin) => {
    localStorage.setItem(storageKey(roomId), JSON.stringify({ id, name, pin: pin ?? null }))
    setParticipantId(id)
  }, [roomId])

  return {
    participants,
    loading,
    participantId,
    isRestoringSession,
    registerNewParticipant,
    restoreParticipant,
    refetch: fetchParticipants,
  }
}
