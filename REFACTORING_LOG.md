# Refactoring Log — 2026-05-04

## 신규 생성 파일

| 파일 | 목적 |
|------|------|
| `src/utils/date.js` | 날짜 포맷 함수 통합 유틸 |
| `src/constants/colors.js` | 색상·한계값 상수 통합 |
| `src/hooks/useRoom.js` | 방(rooms) 로드 로직 커스텀 훅 추출 |

---

## Step 1 — 날짜 유틸 통합 (`src/utils/date.js`)

**변경 내용:** `WEEKDAYS`, `formatDateLong`, `formatDateFull`, `formatDateMedium`, `datesInRange` 를 단일 모듈로 통합.

**영향 파일:**

| 파일 | 변경 |
|------|------|
| `src/components/ConfirmedBanner.jsx` | 로컬 `formatDateLong` 제거 → import |
| `src/components/ConfirmedModal.jsx` | 로컬 `formatDateFull` 제거 → import |
| `src/components/RankingList.jsx` | 로컬 `formatDateLong` 제거 → import |
| `src/components/Calendar.jsx` | 로컬 `WEEKDAYS` 제거 → import |
| `src/pages/VotePage.jsx` | 로컬 `formatDateMedium`, `datesInRange` 제거 → import |
| `src/pages/ConfirmedPage.jsx` | 로컬 `formatDateFull` 제거 → import |

---

## Step 2 — 상수 통합 (`src/constants/colors.js`)

**변경 내용:** `HEAT_COLORS`, `PARTICIPANT_COLORS`, `MAX_PARTICIPANTS_LIMIT`, `PIN_LENGTH`, `MAX_CALENDAR_YEAR` 를 단일 모듈로 통합.

**영향 파일:**

| 파일 | 변경 |
|------|------|
| `src/components/HeatmapCell.jsx` | 로컬 `HEAT_COLORS` 제거 → import |
| `src/components/Calendar.jsx` | 하드코딩 `2027` → `MAX_CALENDAR_YEAR` import |
| `src/pages/VotePage.jsx` | 인라인 범례 배열 → `HEAT_COLORS.slice(1)` |
| `src/hooks/useParticipants.js` | 로컬 export `PARTICIPANT_COLORS` 제거 → import |
| `src/pages/HomePage.jsx` | 로컬 `MAX_LIMIT` 제거 → `MAX_PARTICIPANTS_LIMIT` import |

---

## Step 3 — 방 로드 훅 분리 (`src/hooks/useRoom.js`)

**변경 내용:** VotePage/ConfirmedPage에 중복된 `rooms` 테이블 로드 `useEffect` 를 `useRoom(roomId)` 훅으로 추출. `document.title` 설정은 페이지별 useEffect로 분리 유지.

**영향 파일:**

| 파일 | 변경 |
|------|------|
| `src/pages/VotePage.jsx` | `room/roomLoading/roomError` state 제거 → `useRoom` |
| `src/pages/ConfirmedPage.jsx` | `room/roomLoading` state 제거 → `useRoom` |

---

## Step 4 — ConfirmedPage 메모 덮어쓰기 버그 수정

**위치:** `src/pages/ConfirmedPage.jsx`

**문제:** `useEffect(() => setMemo(appointment?.memo ?? ''), [appointment])` 가 실시간 업데이트 시 사용자 입력 중인 메모를 덮어씀.

**수정:** `useRef(false)` 플래그로 초기화를 1회만 실행하도록 변경.

---

## Step 5 — HeatmapCell React.memo + Calendar useCallback

**변경 내용:**
- `src/components/HeatmapCell.jsx`: `export default memo(HeatmapCell)` 적용
- `src/components/Calendar.jsx`: `handleRangeClick` → `useCallback`, `handleHoverOut` → `useCallback` 추가

**효과:** multi 모드에서 선택 변경 시 변경된 셀만 재렌더됨.

---

## Step 6 — fetch 에러 처리 추가

**변경 내용:** 아래 훅의 fetch 함수에서 에러를 조용히 무시하던 패턴을 `console.error` 로그 출력으로 변경.

| 훅 | 함수 |
|----|------|
| `useParticipants.js` | `fetchParticipants` |
| `useVotes.js` | `fetchAvailabilities` |
| `useAppointment.js` | `fetchAppointment` |
| `useParticipantTimes.js` | `fetchTimes` |

---

## Step 7 — ConfirmedPage 변수 섀도잉 수정

**위치:** `src/pages/ConfirmedPage.jsx`

**문제:** `toHHMM` 파라미터 `t` 와 `times.find(t => ...)` 콜백 파라미터 `t` 가 섀도잉.

**수정:** `times.find(t => ...)` → `times.find(pt => ...)` (pt = participantTime)

---

## 기능 변경 없음 확인 체크리스트

- [ ] HomePage 방 만들기 플로우 정상 (날짜 범위 선택 → 방 생성 → 링크 복사)
- [ ] VotePage 투표 저장 및 실시간 반영 정상 (이름 등록 → 날짜 선택 → 저장 → 히트맵)
- [ ] ConfirmedPage 시간/메모 저장 정상 (시간 입력 저장 → 메모 작성 저장)
