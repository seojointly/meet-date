import { useState, useEffect, useRef } from 'react'
import { fetchRoom } from '../services/roomService'

export function useRoom(roomId) {
  const cacheRef = useRef({})

  const [room, setRoom]               = useState(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomError, setRoomError]     = useState(null)

  useEffect(() => {
    if (!roomId) return

    // 동일 roomId는 캐시에서 즉시 반환 — Supabase 왕복 생략
    if (cacheRef.current[roomId]) {
      setRoom(cacheRef.current[roomId])
      setRoomLoading(false)
      return
    }

    let cancelled = false

    fetchRoom(roomId)
      .then(data => {
        if (cancelled) return
        cacheRef.current[roomId] = data
        setRoom(data)
        setRoomLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setRoomError('존재하지 않는 방입니다.')
        setRoomLoading(false)
      })

    return () => { cancelled = true }
  }, [roomId])

  return { room, roomLoading, roomError }
}
