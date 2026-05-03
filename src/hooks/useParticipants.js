import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const MAX_PARTICIPANTS = 4
export const PARTICIPANT_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7']

const storageKey = (roomId) => `participant_${roomId}`

export function useParticipants(roomId) {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [participantId, setParticipantId] = useState(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  const fetchParticipants = useCallback(async () => {
    if (!roomId) return
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at')
    if (!error) setParticipants(data ?? [])
    setLoading(false)
  }, [roomId])

  // localStorage 기반 세션 복원
  useEffect(() => {
    if (!roomId) return
    const restoreSession = async () => {
      setIsRestoringSession(true)
      try {
        const stored = localStorage.getItem(storageKey(roomId))
        if (stored) {
          const { id } = JSON.parse(stored)
          const { data, error } = await supabase
            .from('participants')
            .select('id')
            .eq('id', id)
            .maybeSingle()
          if (!error && data) {
            setParticipantId(id)
          } else {
            localStorage.removeItem(storageKey(roomId))
          }
        }
      } catch {
        localStorage.removeItem(storageKey(roomId))
      } finally {
        setIsRestoringSession(false)
      }
    }
    restoreSession()
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

  const registerParticipant = useCallback(async (name) => {
    if (participants.length >= MAX_PARTICIPANTS) {
      throw Object.assign(
        new Error(`정원이 가득 찼습니다 (${participants.length}/${MAX_PARTICIPANTS})`),
        { code: 'FULL' }
      )
    }
    if (participants.some(p => p.name === name)) {
      throw Object.assign(new Error('이미 사용 중인 이름입니다'), { code: 'DUPLICATE' })
    }
    const color = PARTICIPANT_COLORS[participants.length % PARTICIPANT_COLORS.length]
    const { data, error } = await supabase
      .from('participants')
      .insert({ room_id: roomId, name, color })
      .select('*')
      .single()
    if (error) {
      if (error.code === '23505') {
        throw Object.assign(new Error('이미 사용 중인 이름입니다'), { code: 'DUPLICATE' })
      }
      throw error
    }
    localStorage.setItem(storageKey(roomId), JSON.stringify({ id: data.id, name: data.name }))
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
