# 리팩토링 기록 — 2026-05-04

## 1. 만료된 방 자동 삭제 및 안내 UI

### 배경
약속이 확정된 뒤 오래 지난 방이 DB에 계속 남아 불필요한 데이터가 누적되는 문제.

### 변경 내용

**백엔드 (Supabase pg_cron — SQL 별도 실행)**
- 약속 확정일(`appointments.confirmed_date`)로부터 3일이 지난 방을 자동 삭제하는 pg_cron 잡 설정
- `rooms` 테이블 CASCADE 삭제로 `participants`, `availabilities`, `appointments`, `participant_times` 연쇄 정리

**프론트엔드 (`src/hooks/useRoom.js`, `src/pages/VotePage.jsx`)**
- `useRoom.js`: `roomError`를 단순 문자열에서 `{ type: 'NOT_FOUND', message }` 객체로 변경. `!data` 케이스와 fetch 에러 모두 동일한 구조로 처리
- `VotePage.jsx`: 삭제된 방 접근 시 에러 화면을 🗓️ 아이콘 + "만료된 방" 설명 + 3일 자동 삭제 안내 + "새 방 만들기" 링크로 교체

---

## 2. 날짜 드래그 선택 안내 문구 추가

### 배경
달력에서 드래그로 연속 날짜를 선택할 수 있는 기능이 있지만 사용자가 인지하지 못하는 경우가 많아 UI 가이드 문구를 추가.

### 변경 내용 (`src/pages/VotePage.jsx`)
- 달력 컴포넌트 바로 위에 안내 문구 렌더링
- 표시 조건: `!hasSubmitted || isEditMode` (첫 투표 전 또는 날짜 변경 모드)
- 숨김 조건: 이미 투표했고 수정 모드가 아닐 때 (`hasSubmitted && !isEditMode`)

```jsx
{(!hasSubmitted || isEditMode) && (
  <div className="flex items-center gap-1.5 text-xs text-blue-500 bg-blue-50
                  rounded-lg px-3 py-2 mb-2">
    <span>👆</span>
    <span>날짜를 누르거나 <strong>드래그</strong>해서 연속으로 선택할 수 있어요!</span>
  </div>
)}
```

---

## 3. 기기 변경 시 재접속 차단 오류 수정

### 배경
새 기기(또는 시크릿 모드)에서 접속하면 `localStorage` 세션이 없는 상태로 시작된다. 이때 정원 초과 체크가 먼저 실행되어 기존 참여자도 방에 재입장하지 못하는 문제.

### 원인
`NameModal`이 클라이언트에 이미 로드된 `participants` 배열로 기존 참여자 여부를 판단했기 때문에, DB에는 존재하는 참여자라도 로컬 상태 기준으로 '신규 참여자'로 처리되어 정원 체크에 걸렸다.

### 변경 내용

**`src/services/participantService.js`**
- `checkExistingParticipant({ roomId, name })`: DB에서 이름 존재 여부만 조회 (PIN 미포함)
- `verifyParticipantPin({ roomId, name, pin })`: PIN을 별도 SELECT 후 클라이언트 비교. 일치 시 `{ verified: true, participantId }`, 불일치 시 `{ verified: false }` 반환

**`src/hooks/useParticipants.js`**
- `registerParticipant` 단일 함수를 두 함수로 분리
  - `registerNewParticipant(name, pin, maxParticipants)`: 신규 등록, 정원 체크 포함
  - `restoreParticipant(id, name, pin)`: 기존 참여자 재입장, 정원 체크 없음

**`src/components/NameModal.jsx`**
- 기존: 단일 폼에서 로컬 배열로 기존 참여자 판별
- 변경: 3단계 step 상태 머신으로 재설계
  1. `name`: 이름 입력 → DB 조회(`checkExistingParticipant`)
  2. `existing_pin`: 기존 참여자 → PIN 입력 → `verifyParticipantPin` → `onRestore`
  3. `new_pin`: 신규 참여자 (정원 여유 있음) → PIN 설정(선택) → `onRegisterNew`
  4. `full`: 신규 참여자인데 정원 초과 → 안내 메시지

**`src/pages/VotePage.jsx`**
- `handleRegister` → `handleRegisterNew` / `handleRestore` 분리
- `NameModal`에 `roomId` prop 추가 전달

### 접속 흐름 요약

```
이름 입력
  ├─ DB에 존재 → PIN 입력 → 검증 통과 → 재입장 (정원 무관)
  └─ DB에 없음
       ├─ 정원 여유 → PIN 설정 → 신규 등록
       └─ 정원 초과 → 입장 불가 안내
```
