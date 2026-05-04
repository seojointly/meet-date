import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useRoom(roomId) {
  const cacheRef = useRef({})

  const [room, setRoom]           = useState(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomError, setRoomError] = useState(null)

  useEffect(() => {
    if (!roomId) return

    // 동일 roomId는 캐시에서 즉시 반환 — Supabase 왕복 생략
    if (cacheRef.current[roomId]) {
      setRoom(cacheRef.current[roomId])
      setRoomLoading(false)
      return
    }

    let cancelled = false

    supabase.from('rooms').select('id, title, date_from, date_to, max_participants').eq('id', roomId).single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setRoomError('존재하지 않는 방입니다.')
        } else {
          cacheRef.current[roomId] = data
          setRoom(data)
        }
        setRoomLoading(false)
      })

    return () => { cancelled = true }
  }, [roomId])

  return { room, roomLoading, roomError }
}
