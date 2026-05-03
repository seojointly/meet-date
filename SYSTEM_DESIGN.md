# System Design

## 현재 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                   Client (Browser)                   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ HomePage │  │ VotePage │  │  ConfirmedPage     │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │              │
│  ┌────▼──────────────▼─────────────────▼──────────┐  │
│  │               Custom Hooks                      │  │
│  │  useRoom · useParticipants · useVotes            │  │
│  │  useAppointment · useParticipantTimes            │  │
│  └────────────────────┬───────────────────────────┘  │
│                        │ supabase-js (anon key)       │
└────────────────────────┼────────────────────────────-┘
                         │
          ┌──────────────▼──────────────┐
          │         Supabase             │
          │  ┌──────────────────────┐   │
          │  │   PostgreSQL DB       │   │
          │  │  rooms               │   │
          │  │  participants        │   │
          │  │  availabilities      │   │
          │  │  appointments        │   │
          │  │  participant_times   │   │
          │  └──────────────────────┘   │
          │  ┌──────────────────────┐   │
          │  │  Realtime (4채널/방) │   │
          │  │  participants-{id}   │   │
          │  │  avail-{id}          │   │
          │  │  appt-{id}           │   │
          │  │  times-{id}          │   │
          │  └──────────────────────┘   │
          └─────────────────────────────┘
                         │
          ┌──────────────▼──────────────┐
          │         Vercel               │
          │  Edge Function               │
          │  api/geo-check.js (KR 전용) │
          └─────────────────────────────┘
```

**데이터 흐름 (현재):**
```
페이지 마운트
  → useRoom      : rooms 조회        (1 round-trip)
  → useParticipants: participants 조회 (2 round-trips — session restore + list)
  → useVotes     : availabilities 조회 (1 round-trip)
  → useAppointment: appointments 조회  (1 round-trip)
  → Realtime 채널 4개 구독
  → UI 렌더링
```

---

## 확장성 한계 및 개선 방향

### 한계 1 — No API Layer (Supabase Direct Access)

클라이언트가 anon key로 DB에 직접 접근합니다. RLS가 유일한 보안 레이어이며, 현재 RLS 정책은 `USING (true)` — 사실상 전체 오픈 상태입니다.

- 레이트 리미팅 없음
- 비즈니스 로직(정원 체크 등)이 클라이언트 JS에 위치 → 우회 가능
- 감사 로그 없음

**개선 방향:** Vercel Edge API Routes 도입, service role key는 서버만 보유

### 한계 2 — Realtime 연결 수 한계

방 1개당 3~4개 채널을 구독합니다.

```
Supabase Free:  200 concurrent connections
동시 접속 방 50개 × 사용자 2명 × 3채널 = 300 connections → 한계 초과
```

`postgres_changes` 방식은 WAL 파싱으로 DB 서버에 지속적 부하를 줍니다.

**개선 방향:** 방당 채널 1개 통합 + Broadcast 방식 혼용 (DAU 1,000 단계)

### 한계 3 — 정원 체크 Race Condition

`useParticipants.js`의 정원 초과 체크가 클라이언트 캐시 기준으로 수행됩니다. DB 레벨 constraint 없음 → 동시 접속 시 정원 초과 가능.

**개선 방향:** DB Function 또는 API 레이어에서 atomic 체크

### 한계 4 — PIN 평문 저장

PIN이 DB에 `text` 컬럼으로 평문 저장됩니다. DB 접근 권한이 있는 누구나 모든 참여자의 PIN을 볼 수 있습니다.

**개선 방향:** `pgcrypto`의 `crypt()` + `gen_salt('bf')`로 bcrypt 해싱

### 한계 5 — `dates[]` 배열 컬럼 (availabilities)

날짜를 배열로 저장하면 특정 날짜의 투표자 집계 시 배열 스캔이 필요합니다. GIN 인덱스 없이는 날짜 범위가 늘수록 성능 저하가 선형으로 증가합니다.

**개선 방향:** `availability_dates` 행 분리 테이블로 정규화 (DAU 1,000 단계)

### 한계 6 — 방 만료 정책 없음

방이 생성 후 영구 존재합니다. DAU 100이 한 달이면 3,000+ 방이 DB에 누적됩니다.

**개선 방향:** `expires_at` 컬럼 + pg_cron 자동 삭제 → **이번에 적용 완료**

### 한계 7 — schema_v2.sql과 실제 스키마 불일치

schema_v2.sql에 다음 항목이 누락되어 있습니다:

| 누락 항목 | 코드에서 사용 위치 |
|---|---|
| `rooms.title` | `HomePage.jsx`, `VotePage.jsx` |
| `rooms.max_participants` | `HomePage.jsx`, `VotePage.jsx` |
| `participants.pin` | `useParticipants.js` |
| `appointments.memo` | `useAppointment.js`, `ConfirmedPage.jsx` |
| `participant_times` 테이블 전체 | `useParticipantTimes.js` |

schema_v2.sql만 실행하면 앱이 즉시 동작하지 않습니다.

---

## 적용된 개선 사항

### DB 인덱스 (`supabase_indexes.sql`)

자주 조회되는 FK 컬럼에 인덱스를 추가합니다. PostgreSQL은 FK에 자동 인덱스를 생성하지 않으므로 명시적 추가가 필요합니다.

| 인덱스 | 테이블 | 대상 쿼리 |
|---|---|---|
| `idx_participants_room_id` | participants | VotePage 진입 시 참여자 목록 조회 |
| `idx_participants_room_name` | participants | 세션 복원 fallback (name + room_id) |
| `idx_availabilities_room_id` | availabilities | 투표 현황 전체 조회 |
| `idx_appointments_room_id` | appointments | 확정 날짜 조회 |
| `idx_participant_times_room_id` | participant_times | 시간 겹침 조회 |

인덱스 적용 전/후 예상 성능:
- Seq Scan(O(N)) → Index Scan(O(log N))
- DAU 100 기준, 방 1,000개 누적 시 쿼리 속도 **10~50배** 향상 예상

### 만료 데이터 정리 정책 (`supabase_cleanup.sql`)

```
rooms.expires_at = created_at + 30 days
매일 자정 (UTC 15:00 = KST 00:00) pg_cron 실행
DELETE FROM rooms WHERE expires_at < now()
  → CASCADE: participants, availabilities, appointments,
             participant_times 자동 삭제
```

DB 무한 성장 방지. 월 3,000+ 방 생성 시에도 상시 활성 방 기준으로만 스토리지 사용.

### 캐싱 전략 (`useRoom.js`)

`rooms` 데이터는 생성 후 사실상 변경되지 않습니다(title, date_from, date_to, max_participants 모두 불변). `useRef`로 컴포넌트 생명주기 내 캐시를 유지합니다.

```js
// 변경 전: roomId가 같아도 StrictMode 이중 호출 시 2회 fetch
useEffect(() => {
  supabase.from('rooms').select('*').eq('id', roomId)...
}, [roomId])

// 변경 후: 첫 fetch 결과를 cacheRef에 저장, 이후 즉시 반환
const cacheRef = useRef({})
useEffect(() => {
  if (cacheRef.current[roomId]) {
    setRoom(cacheRef.current[roomId])  // Supabase 왕복 없음
    return
  }
  // ... fetch 후 cacheRef.current[roomId] = data
}, [roomId])
```

효과: React StrictMode 개발 환경 이중 실행, 동일 방 재진입 시 불필요한 네트워크 요청 제거.

### Supabase Realtime 채널 중복 방지 (기존 코드 확인)

모든 훅의 채널 이름이 이미 고정 키(`roomId` 기반)로 설정되어 있음을 확인했습니다. 변경 불필요.

| 훅 | 채널 이름 |
|---|---|
| `useParticipants` | `participants-{roomId}` |
| `useVotes` | `avail-{roomId}` |
| `useAppointment` | `appt-{roomId}` |
| `useParticipantTimes` | `times-{roomId}` |

Supabase 클라이언트는 동일 이름의 채널을 재사용하므로 타임스탬프 등 가변 키 사용 시 채널 누수가 발생할 수 있습니다. 현재 구조는 안전합니다.

---

## 단계별 확장 로드맵

| 단계 | DAU | 병목 지점 | 주요 변경 사항 |
|------|-----|-----------|--------------|
| **현재** | ~50 | 없음 | Supabase 직접 호출 + 인덱스 추가 (완료) |
| **소규모** | ~100 | FK Seq Scan, 방 누적 | 인덱스 추가, pg_cron 방 정리, PIN bcrypt 해싱 |
| **중규모** | ~1,000 | Realtime 연결 한계, Race Condition | Vercel Edge API 레이어, Supabase Anonymous Auth, Realtime 채널 통합, Supabase Pro |
| **대규모** | ~10,000 | DB 읽기 부하, Connection Pool 고갈 | Upstash Redis 캐시, PgBouncer Pool, Read Replica, `availability_dates` 정규화, Sentry 모니터링 |

### 소규모 단계 상세 (DAU ~100)

```
현재 스택 유지, SQL 레벨 개선만 필요:

[ 완료 ] DB 인덱스 추가          → supabase_indexes.sql
[ 완료 ] 방 만료 자동 정리       → supabase_cleanup.sql
[ 완료 ] useRoom 캐싱            → useRoom.js cacheRef
[ 미완 ] PIN bcrypt 해싱         → pgcrypto + useParticipants.js 수정 필요
[ 미완 ] schema_v2.sql 실제 동기화 → 문서 수정 필요
```

### 중규모 단계 상세 (DAU ~1,000)

```
Vercel Edge API 레이어 도입:

POST   /api/rooms                → 방 생성 (입력 검증, sanitize)
POST   /api/rooms/:id/join       → 참여자 등록 (atomic 정원 체크, PIN bcrypt)
PUT    /api/rooms/:id/votes      → 투표 저장 (세션 토큰 검증)
POST   /api/rooms/:id/confirm    → 날짜 확정 (권한 검증)

Supabase Auth Anonymous 도입:
  signInAnonymously() → JWT → RLS를 auth.uid() 기반으로 강화

Realtime 채널 통합:
  방당 4채널 → 1채널 (room-{id})로 통합
  Broadcast 방식 혼용으로 postgres_changes 부하 감소

비용: Supabase Pro $25/월 + Vercel Pro $20/월 = $45/월
```

### 대규모 단계 상세 (DAU ~10,000)

```
Upstash Redis (Vercel 연동):
  rooms, participants → TTL 5분 캐시
  invalidate on Realtime event

PgBouncer Transaction Mode:
  DB 직접 연결 수 1/10로 감소

availability_dates 정규화:
  dates[] → 행 분리 테이블
  날짜별 집계 쿼리 O(N) → O(1)

Read Replica:
  집계 쿼리(히트맵, 순위)를 읽기 복제본으로 라우팅

모니터링:
  Sentry (에러), Vercel Analytics (성능), Supabase Logs (slow query)

비용: ~$85/월
```

---

## 실행 필요한 SQL

### Step 1 — 인덱스 추가

`supabase_indexes.sql` 전체를 Supabase SQL Editor에서 실행합니다.

```
대시보드 → SQL Editor → New Query → 파일 내용 붙여넣기 → Run
```

### Step 2 — 방 만료 정책 설정

1. `대시보드 → Database → Extensions → pg_cron → Enable`
2. `supabase_cleanup.sql` 전체를 SQL Editor에서 실행합니다.

```
-- 적용 확인
SELECT jobid, jobname, schedule FROM cron.job;
```

### Step 3 — 실제 스키마 동기화 (별도 작업 필요)

`schema_v2.sql`에 누락된 컬럼/테이블을 추가해야 합니다.
신규 환경 세팅 시 아래 항목이 없으면 앱이 즉시 고장납니다.

```sql
-- schema_v2.sql에 추가 필요한 항목들
ALTER TABLE rooms ADD COLUMN title text NOT NULL DEFAULT '모임';
ALTER TABLE rooms ADD COLUMN max_participants int NOT NULL DEFAULT 4;
ALTER TABLE participants ADD COLUMN pin text;
ALTER TABLE appointments ADD COLUMN memo text;

CREATE TABLE IF NOT EXISTS participant_times (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id uuid        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  start_time     time        NOT NULL,
  end_time       time        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, participant_id)
);
ALTER PUBLICATION supabase_realtime ADD TABLE participant_times;
```

---

## 파일 목록

| 파일 | 유형 | 목적 |
|---|---|---|
| `supabase_indexes.sql` | SQL (신규) | FK 인덱스 추가 — SQL Editor에서 실행 |
| `supabase_cleanup.sql` | SQL (신규) | 방 만료 정책 + pg_cron 스케줄 |
| `src/hooks/useRoom.js` | 코드 (수정) | cacheRef 기반 rooms 캐싱 |
| `schema_v2.sql` | SQL (미완) | 실제 운영 스키마와 동기화 필요 |
