-- ════════════════════════════════════════════════════════════════
-- 모임 날짜 투표 앱 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 아래 전체를 실행하세요.
-- ════════════════════════════════════════════════════════════════

-- ── 1. rooms 테이블 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL    DEFAULT now(),
  date_from      date        NOT NULL,
  date_to        date        NOT NULL,
  confirmed_date date                               -- 확정 날짜 (nullable)
);

-- ── 2. votes 테이블 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_name   text        NOT NULL,
  dates       date[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_name)       -- UPSERT 기준 컬럼
);

-- ── 3. updated_at 자동 갱신 트리거 ─────────────────────────────
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS votes_set_updated_at ON votes;
CREATE TRIGGER votes_set_updated_at
  BEFORE UPDATE ON votes
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ── 4. Realtime 활성화 (votes 테이블) ───────────────────────────
-- votes 테이블의 INSERT / UPDATE / DELETE 이벤트를 구독할 수 있게 합니다.
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- ── 5. Row-Level Security (RLS) ─────────────────────────────────
-- anon 키로 읽기·쓰기를 허용합니다.
-- 주의: 프로덕션 배포 전 더 엄격한 정책으로 교체하는 것을 권장합니다.

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- rooms: 누구나 조회·생성·수정 가능
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true);

-- votes: 누구나 조회·생성·수정 가능
CREATE POLICY "votes_select" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_update" ON votes FOR UPDATE USING (true);
