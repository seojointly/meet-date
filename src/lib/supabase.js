import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Supabase] 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: { persistSession: false },
})
