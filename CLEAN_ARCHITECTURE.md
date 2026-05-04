# Clean Architecture

## 작업 일시
2026-05-04

## 아키텍처 개요

```
Pages         (HomePage, VotePage, ConfirmedPage)
  ↓ (use)
Hooks         (useRoom, useParticipants, useVotes, useAppointment, useParticipantTimes)
  ↓ (call)
Services  ←→  Supabase
  ↓ (use)
Domain        (순수 비즈니스 로직 — 외부 의존성 없음)
  ↓ (use)
Constants     (src/domain/constants.js)
```

## 레이어별 역할

| 레이어 | 위치 | 역할 | 외부 의존성 |
|--------|------|------|------------|
| Domain | `src/domain/` | 비즈니스 규칙, 순수 함수 | 없음 |
| Services | `src/services/` | Supabase 접근 추상화 | supabase-js |
| Hooks | `src/hooks/` | UI 상태 + Realtime 구독 | Services, Domain |
| Components | `src/components/` | 순수 UI 렌더링 | Domain (상수/타입만) |
| Pages | `src/pages/` | 훅 + 컴포넌트 조합 | Hooks, Components, Domain |

## 최종 폴더 구조

```
src/
├── domain/
│   ├── constants.js       ← HEAT_COLORS, PARTICIPANT_COLORS, 앱 상수
│   ├── date.js            ← formatDateLong/Full/Medium, datesInRange, WEEKDAYS
│   ├── time.js            ← toHHMM, formatTime, formatTimeRange, calcOverlap
│   ├── participant.js     ← validatePin, assignColor, isRoomFull
│   └── vote.js            ← buildHeatmapData, buildRanking, hasUserSubmitted
│
├── services/
│   ├── roomService.js         ← fetchRoom, createRoom
│   ├── participantService.js  ← fetchParticipants, createParticipant,
│   │                             fetchParticipantById, fetchParticipantByName, verifyPin
│   ├── voteService.js         ← fetchAvailabilities, saveAvailability
│   ├── appointmentService.js  ← fetchAppointment, confirmDate, cancelAppointment, saveMemo
│   └── timeService.js         ← fetchParticipantTimes, saveParticipantTime
│
├── hooks/
│   ├── useRoom.js             ← room 조회 + 캐시
│   ├── useParticipants.js     ← 참여자 목록 + 세션 복원 + Realtime
│   ├── useVotes.js            ← 투표 데이터 + Realtime + 폴링 폴백
│   ├── useAppointment.js      ← 확정 일정 CRUD + Realtime
│   └── useParticipantTimes.js ← 참여자 시간 CRUD + Realtime
│
├── components/
│   ├── Calendar.jsx        ← 날짜 선택 캘린더 (range / multi 모드)
│   ├── HeatmapCell.jsx     ← 개별 날짜 셀 (히트맵 색상)
│   ├── NameModal.jsx       ← 이름/PIN 입력 모달
│   ├── RankingList.jsx     ← 날짜 득표 순위 목록
│   ├── ParticipantBar.jsx  ← 참여자 현황 바
│   ├── ConfirmedBanner.jsx ← 확정 날짜 상단 배너
│   ├── ConfirmedModal.jsx  ← 확정 완료 안내 모달
│   ├── GeoGuard.jsx        ← 지역 접근 제어
│   └── Toast.jsx           ← 개별 토스트 알림
│
├── pages/
│   ├── HomePage.jsx        ← 방 생성
│   ├── VotePage.jsx        ← 날짜 투표 메인
│   └── ConfirmedPage.jsx   ← 확정 후 시간·메모 입력
│
├── contexts/
│   └── ToastContext.jsx    ← 전역 토스트 알림
│
├── lib/
│   └── supabase.js         ← Supabase 클라이언트 초기화
│
└── utils/
    └── date.js             ← (레거시 — domain/date.js로 이전 완료, 삭제 가능)
```

## 마이그레이션 내역

| 이전 위치 | 이후 위치 | 변경 유형 |
|----------|----------|---------|
| `utils/date.js` | `domain/date.js` | 이동 |
| `constants/colors.js` | `domain/constants.js` | 이동 |
| `VotePage.jsx` — `buildHeatmapData()` | `domain/vote.js` | 분리 |
| `VotePage.jsx` — `hasSubmitted` 인라인 useMemo | `domain/vote.js` — `hasUserSubmitted()` | 분리 |
| `RankingList.jsx` — 순위 정렬 useMemo | `domain/vote.js` — `buildRanking()` | 분리 |
| `ConfirmedPage.jsx` — `formatTime()` | `domain/time.js` — `formatTime()`, `formatTimeRange()` | 분리 |
| `ConfirmedPage.jsx` — `toHHMM` 인라인 클로저 | `domain/time.js` — `toHHMM()` | 분리 |
| `ConfirmedPage.jsx` — 겹침 시간 useMemo 인라인 | `domain/time.js` — `calcOverlap()` | 분리 |
| `NameModal.jsx` — `!/^\d{4}$/.test(pin)` | `domain/participant.js` — `validatePin()` | 분리 |
| `NameModal.jsx` — `participants.length >= max` | `domain/participant.js` — `isRoomFull()` | 분리 |
| `useParticipants.js` — `PARTICIPANT_COLORS[i % n]` | `domain/participant.js` — `assignColor()` | 분리 |
| `useParticipants.js` — `participants.length >= max` | `domain/participant.js` — `isRoomFull()` | 분리 |
| `hooks/*.js` 전체 — `supabase.from(...)` 직접 호출 | `services/*.js` | 분리 (CLEAN-2) |
| `HomePage.jsx` — `supabase.from('rooms').insert(...)` | `services/roomService.js` | 분리 (CLEAN-2) |

## 의존성 규칙

- **Domain**은 절대 외부 라이브러리를 import하지 않음 (domain 간 import는 허용)
- **Services**는 `lib/supabase.js`만 import 가능
- **Hooks**는 Services + Domain + `lib/supabase.js`(Realtime 채널 전용)만 import 가능
- **Components**는 Domain의 상수/순수 함수만 import 가능
- **Pages**는 Hooks + Components + Domain import 가능

## 기능 변경 없음 확인

- [ ] 방 만들기 → 투표 → 확정 플로우 정상
- [ ] Realtime 동기화 정상 (avail / participants / appt / times 채널)
- [ ] 연결 끊김 시 5초 폴링 폴백 정상
- [ ] 세션 복원 및 PIN 인증 정상 (ID → name 2단계 폴백)
- [ ] 히트맵 및 날짜 순위 표시 정상
- [ ] 시간 계산 및 겹침 표시 정상
