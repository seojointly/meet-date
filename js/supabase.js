// ════════════════════════════════════════════════════════════════
// Supabase 클라이언트 초기화
//
// 설정 방법:
//   1. https://supabase.com/dashboard 에서 프로젝트 선택
//   2. Settings > API 에서 아래 두 값을 복사
//      ┌─ Project URL  → SUPABASE_URL
//      └─ anon / public key → SUPABASE_ANON_KEY
//   3. 아래 두 상수를 실제 값으로 교체
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL      = 'https://your-project-ref.supabase.co'; // ← 교체
const SUPABASE_ANON_KEY = 'your-anon-public-key';                 // ← 교체

// Supabase JS SDK는 index.html / vote.html의 <script> CDN 태그로 로드됩니다.
// 이 파일은 CDN 스크립트보다 반드시 뒤에 위치해야 합니다.
const _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// 전역 참조 — 모든 JS 파일에서 window.db 로 접근
window.db = _client;
