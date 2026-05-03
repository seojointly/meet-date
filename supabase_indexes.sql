-- ════════════════════════════════════════════════════════════════
-- 모임일자앱 — 성능 인덱스
-- Supabase 대시보드 > SQL Editor 에서 전체 실행
-- ════════════════════════════════════════════════════════════════

-- ── participants ────────────────────────────────────────────────
-- VotePage 진입 시 participants 조회 (room_id 기준)
CREATE INDEX IF NOT EXISTS idx_participants_room_id
  ON participants(room_id);

-- 세션 복원 시 name + room_id 복합 조회 (useParticipants.js fallback 경로)
CREATE INDEX IF NOT EXISTS idx_participants_room_name
  ON participants(room_id, name);

-- ── availabilities ──────────────────────────────────────────────
-- 투표 현황 전체 조회 (room_id 기준)
CREATE INDEX IF NOT EXISTS idx_availabilities_room_id
  ON availabilities(room_id);

-- ── appointments ────────────────────────────────────────────────
-- 확정 날짜 조회 (room_id 기준)
CREATE INDEX IF NOT EXISTS idx_appointments_room_id
  ON appointments(room_id);

-- ── participant_times ───────────────────────────────────────────
-- ConfirmedPage 시간 조회 (room_id 기준)
CREATE INDEX IF NOT EXISTS idx_participant_times_room_id
  ON participant_times(room_id);

-- ── 적용 확인 ───────────────────────────────────────────────────
-- 실행 후 아래 쿼리로 인덱스 생성 여부를 확인할 수 있습니다.
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
