# Debug Log

## 작업 일시
2026-05-04

## 개요
프로덕션 배포 전 보안·안정성 점검: 지역 접근 제한, Realtime 구독 누수, 경쟁 상태, 세션 복원 엣지 케이스, 타임존 버그, 시간 계산 예외, PIN 보안 총 7개 항목 수정.

---

## 작업 내역

### 1. 한국 전용 접속 제한

- 구현 방식: Vercel Edge Function (KR 이외 국가 → HTTP 403 응답)
- 생성 파일: `api/geo-check.js`, `src/components/GeoGuard.jsx`
- 변경 파일: `vercel.json`, `src/main.jsx`
- 동작:
  - 해외 IP → `/api/geo-check` 엔드포인트에서 403 반환, `GeoGuard` 컴포넌트가 차단 화면 렌더링
  - `localhost` / `127.0.0.1` 환경 → 국가 확인 없이 자동 통과

---

### 2. Supabase Realtime 구독 누수 점검 및 수정

- 문제: `useEffect` cleanup에서 채널 구독 해제(`channel.unsubscribe()`)가 누락된 경우, 컴포넌트 언마운트 후에도 채널이 살아 있어 메모리 누수 및 중복 이벤트 수신 발생 가능
- 원인: 각 훅이 독립적으로 Supabase 채널을 생성하지만 일부 훅에서 `return () => { supabase.removeChannel(channel) }` 패턴이 불완전하게 적용됨
- 수정 내용: 모든 훅의 `useEffect`에서 cleanup 함수가 채널을 올바르게 제거하도록 패턴 통일
- 영향 파일: `src/hooks/useParticipants.js`, `src/hooks/useVotes.js`, `src/hooks/useAppointment.js`, `src/hooks/useParticipantTimes.js`

---

### 3. 경쟁 상태 (Race Condition) 방어

- 문제: 컴포넌트 초기 렌더링 시 `roomId`가 아직 `null`인 상태에서 Supabase 쿼리가 실행되면 잘못된 조건(`.eq('room_id', null)`)으로 요청이 발생하거나 오류가 throw됨
- 원인: React Router의 파라미터 수신과 `useEffect` 실행 사이의 타이밍 차이, 또는 직접 URL 접근 시 초기값이 `undefined`로 넘어오는 경우
- 수정 내용: 각 훅 상단에 `if (!roomId) return;` null 가드 추가하여 `roomId`가 유효한 경우에만 쿼리 실행
- 영향 파일: `src/hooks/useRoom.js`, `src/hooks/useParticipants.js`, `src/hooks/useVotes.js`

---

### 4. localStorage 세션 복원 엣지 케이스 처리

- 문제: 아래 3가지 상황에서 세션 복원이 실패하거나 잘못된 상태로 진입
  1. DB에서 삭제된 참여자의 `id`가 localStorage에 남아 있는 경우
  2. PIN이 변경되거나 다른 기기에서 동일 이름으로 재등록된 경우
  3. 멀티탭 환경에서 탭 간 세션 불일치
- 원인: 복원 시 DB 존재 여부 및 PIN 일치 여부를 검증하지 않고 localStorage 값을 그대로 신뢰
- 수정 내용:
  - `id`로 복원 실패 시 `name + room_id`로 재조회하는 fallback 로직 추가
  - PIN 불일치 시 localStorage 항목 삭제 후 이름 입력 모달 재표시
  - DB에 해당 참여자가 없으면 세션 초기화
- 영향 파일: `src/hooks/useParticipants.js`, `src/components/NameModal.jsx`

---

### 5. 날짜 계산 타임존 버그 수정

- 문제: `new Date('2024-05-04')`는 UTC 기준 자정으로 파싱되어 KST(UTC+9) 환경에서 하루 전날(5월 3일)로 표시되는 오프바이원 버그
- 원인: ISO 8601 날짜 문자열(`YYYY-MM-DD`)을 `new Date()`에 전달하면 UTC midnight으로 해석되지만, `toLocaleDateString()` 등 로컬 시간 기준 출력 시 시차만큼 이전 날짜로 렌더링됨
- 수정 내용: `new Date(str)` → `new Date(str + 'T00:00:00')` (로컬 시간 기준 파싱) 또는 `str.split('-')`으로 연·월·일을 직접 분리하여 `new Date(year, month-1, day)` 생성 방식으로 변경
- 영향 파일: `src/utils/date.js`

---

### 6. 겹치는 시간 계산 엣지 케이스 처리

- 문제: 참여자가 1명일 때 또는 `start >= end`인 잘못된 시간 범위를 입력했을 때 공통 시간대 계산 로직이 오작동하거나 빈 결과를 비정상적으로 처리
- 원인:
  - 1명 케이스: 교집합 알고리즘이 2명 이상을 전제로 설계됨
  - `start >= end`: 유효하지 않은 범위가 그대로 계산에 포함됨
- 수정 내용:
  - 참여자가 1명인 경우 해당 참여자의 시간대를 그대로 공통 시간으로 반환
  - `start >= end` 입력은 저장 전 필터링하여 무효 데이터 제거
- 영향 파일: `src/hooks/useParticipantTimes.js`

---

### 7. PIN 보안 개선

- 문제: 참여자 목록 조회 시 `pin` 컬럼이 함께 SELECT되어 클라이언트 메모리에 모든 참여자의 PIN이 노출됨
- 원인: Supabase 쿼리에서 `select('*')`를 사용하거나 명시적으로 `pin`을 포함한 컬럼 목록을 지정
- 수정 내용:
  - 일반 참여자 목록 조회 시 `pin` 컬럼 제외 (`select('id, name, room_id, ...')`)
  - PIN 검증은 로그인 시 별도 단일 조회로 분리하여 본인 PIN만 확인
- 영향 파일: `src/hooks/useParticipants.js`

---

## 엣지 케이스 처리 목록

| 케이스 | 파일 | 처리 방법 |
|--------|------|-----------|
| `roomId` null 상태에서 Supabase 쿼리 실행 | `useRoom.js`, `useParticipants.js`, `useVotes.js` | `if (!roomId) return` 가드 |
| DB에서 삭제된 참여자 ID가 localStorage에 잔존 | `useParticipants.js` | id 복원 실패 시 name+room_id fallback 후 실패 시 세션 초기화 |
| PIN 불일치 (타기기 재등록 등) | `useParticipants.js`, `NameModal.jsx` | localStorage 삭제 후 이름 모달 재표시 |
| 멀티탭 환경에서 세션 불일치 | `useParticipants.js` | DB 재조회 결과 기준으로 세션 덮어쓰기 |
| `new Date('YYYY-MM-DD')` UTC 파싱으로 인한 날짜 오프셋 | `src/utils/date.js` | 로컬 시간 기준 파싱 (`T00:00:00` 접미사 또는 split 파싱) |
| 참여자 1명일 때 공통 시간 계산 오작동 | `useParticipantTimes.js` | 1명은 본인 시간대를 공통 결과로 직접 반환 |
| `start >= end` 시간 범위 입력 | `useParticipantTimes.js` | 저장 전 유효성 검증으로 무효 범위 필터링 |
| Realtime 채널 미해제로 인한 메모리 누수 | `useParticipants.js`, `useVotes.js`, `useAppointment.js`, `useParticipantTimes.js` | `useEffect` cleanup에서 `supabase.removeChannel()` 통일 |
| 해외 IP 접속 | `api/geo-check.js`, `GeoGuard.jsx` | Vercel Edge에서 403 반환, 차단 화면 렌더링 |
| 참여자 목록 조회 시 타인 PIN 노출 | `useParticipants.js` | SELECT에서 pin 컬럼 제외, 본인 검증은 별도 조회 |

---

## 기능 변경 없음 확인

- [ ] 한국 IP 접속 정상
- [ ] 방 만들기 → 투표 → 확정 플로우 정상
- [ ] Realtime 동기화 정상 (참여자, 투표, 확정, 시간)
- [ ] 세션 복원 정상 (새로고침, 재접속, 멀티탭)
- [ ] 날짜 표시 정상 (KST 환경에서 오프바이원 없음)
- [ ] 시간 겹침 계산 정상 (1명, 다수 참여자, 경계값)
- [ ] PIN 입력 및 검증 정상
