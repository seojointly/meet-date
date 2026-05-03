-- ════════════════════════════════════════════════════════════════
-- 모임일자앱 — 만료 방 자동 정리 정책
-- Supabase 대시보드 > SQL Editor 에서 전체 실행
-- 선행 조건: Database > Extensions 에서 pg_cron 활성화 필요
-- ════════════════════════════════════════════════════════════════

-- ── 1. pg_cron 확장 활성화 ──────────────────────────────────────
-- Supabase 대시보드 Extensions 탭에서 활성화하거나 아래 SQL 실행
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 2. rooms 테이블에 만료 컬럼 추가 ────────────────────────────
-- 방 생성 시 자동으로 30일 후 만료 일시가 설정됩니다.
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS expires_at timestamptz
  DEFAULT now() + INTERVAL '30 days';

-- 기존 방의 만료 일시를 created_at 기준으로 소급 적용
UPDATE rooms
  SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- expires_at 인덱스 (만료 쿼리 성능)
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at
  ON rooms(expires_at);

-- ── 3. 만료 방 삭제 pg_cron 스케줄 ─────────────────────────────
-- 매일 자정(KST 00:00 = UTC 15:00)에 실행
-- rooms 삭제 → ON DELETE CASCADE로 연관 데이터 자동 삭제:
--   participants → availabilities (CASCADE)
--   participants → participant_times (CASCADE)
--   rooms       → appointments (CASCADE)
SELECT cron.schedule(
  'cleanup-expired-rooms',
  '0 15 * * *',
  $$DELETE FROM rooms WHERE expires_at < now()$$
);

-- ── 4. 스케줄 확인 ──────────────────────────────────────────────
-- 등록된 cron job 목록 확인
-- SELECT jobid, jobname, schedule, command
-- FROM cron.job
-- ORDER BY jobid;

-- ── 5. 수동 실행 (테스트용) ──────────────────────────────────────
-- DELETE FROM rooms WHERE expires_at < now();

-- ── 6. 기존 스케줄 재등록 시 (중복 방지) ───────────────────────
-- SELECT cron.unschedule('cleanup-expired-rooms');
-- 위 unschedule 실행 후 3번 SELECT cron.schedule(...)을 다시 실행
