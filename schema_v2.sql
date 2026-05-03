-- ════════════════════════════════════════════════════════════════
-- 모임 날짜 투표 앱 v2 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 전체 실행
-- ════════════════════════════════════════════════════════════════

-- ── 1. rooms ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL    DEFAULT now(),
  date_from  date        NOT NULL,
  date_to    date        NOT NULL
);

-- ── 2. participants (방별 최대 4명) ─────────────────────────────
CREATE TABLE IF NOT EXISTS participants (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT '#22c55e',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, name)
);

-- ── 3. availabilities (각 참여자의 가능한 날짜) ─────────────────
CREATE TABLE IF NOT EXISTS availabilities (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  room_id        uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  dates          date[]      NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id)
);

-- ── 4. appointments (확정 날짜) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  confirmed_date date        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id)
);

-- ── 5. updated_at 자동 갱신 트리거 ─────────────────────────────
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS availabilities_updated_at ON availabilities;
CREATE TRIGGER availabilities_updated_at
  BEFORE UPDATE ON availabilities
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP TRIGGER IF EXISTS appointments_updated_at ON appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ── 6. Realtime 활성화 ──────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE availabilities;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;

-- ── 7. Row-Level Security ───────────────────────────────────────
ALTER TABLE rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments  ENABLE ROW LEVEL SECURITY;

-- rooms
DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
DROP POLICY IF EXISTS "rooms_update" ON rooms;
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true);

-- participants
DROP POLICY IF EXISTS "participants_select" ON participants;
DROP POLICY IF EXISTS "participants_insert" ON participants;
CREATE POLICY "participants_select" ON participants FOR SELECT USING (true);
CREATE POLICY "participants_insert" ON participants FOR INSERT WITH CHECK (true);

-- availabilities
DROP POLICY IF EXISTS "availabilities_select" ON availabilities;
DROP POLICY IF EXISTS "availabilities_insert" ON availabilities;
DROP POLICY IF EXISTS "availabilities_update" ON availabilities;
CREATE POLICY "availabilities_select" ON availabilities FOR SELECT USING (true);
CREATE POLICY "availabilities_insert" ON availabilities FOR INSERT WITH CHECK (true);
CREATE POLICY "availabilities_update" ON availabilities FOR UPDATE USING (true);

-- appointments
DROP POLICY IF EXISTS "appointments_select" ON appointments;
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
DROP POLICY IF EXISTS "appointments_update" ON appointments;
DROP POLICY IF EXISTS "appointments_delete" ON appointments;
CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (true);
CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (true);
CREATE POLICY "appointments_delete" ON appointments FOR DELETE USING (true);
