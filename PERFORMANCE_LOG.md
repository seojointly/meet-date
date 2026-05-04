# Performance Optimization Log

## 작업 일시
2026-05-04

## 최적화 항목

| 항목 | 문제 | 해결 방법 | 영향 파일 |
|------|------|----------|----------|
| 리렌더링 차단 | HeatmapCell에 매 렌더마다 새 함수 객체 전달 → memo 무효화 | 이벤트 위임(Calendar 그리드 레벨)으로 onClick/onKeyboardActivate 제거, 커스텀 memo 비교 함수 추가 | HeatmapCell.jsx, Calendar.jsx |
| 리렌더링 차단 | ParticipantBar, RankingList에 memo 없어 VotePage 리렌더 시 매번 재실행 | React.memo 적용 | ParticipantBar.jsx, RankingList.jsx |
| 리렌더링 차단 | VotePage 핸들러 5개가 매 렌더마다 새 참조 생성 | useCallback 적용 | VotePage.jsx |
| 리렌더링 차단 | hasSubmitted, myName을 매 렌더마다 재계산 | useMemo 적용 | VotePage.jsx |
| 리렌더링 차단 | ParticipantBar 내 hasSubmitted가 O(P×A) 탐색 | submittedSet useMemo로 O(A) 변환 | ParticipantBar.jsx |
| 로직 개선 | buildHeatmapData가 O(D×P×D) — includes()가 선형 탐색 | dateIndex Map 사전 구축으로 O(P×D+D) | VotePage.jsx |
| 로직 개선 | cells 배열을 매 렌더마다 재생성 (Date 객체 포함) | useMemo([year, month])로 month/year 변경 시만 재계산 | Calendar.jsx |
| 번들 분할 | 3페이지가 단일 번들 — VotePage 코드를 홈에서도 로드 | React.lazy + Suspense로 페이지별 chunk 분리 | App.jsx |
| 쿼리 최적화 | SELECT * 사용으로 불필요한 컬럼 전송 | 필요 컬럼만 명시 | useRoom.js, useAppointment.js, useParticipantTimes.js, useParticipants.js |
| 메모리 누수 | unmount 후 fetch 완료 시 setState 호출 가능 | mounted ref 패턴 적용 | useVotes.js, useAppointment.js, useParticipantTimes.js, useParticipants.js |

## 기능 변경 없음 확인
- [ ] 방 만들기 → 투표 → 확정 플로우 정상
- [ ] 드래그 날짜 선택 정상
- [ ] 실시간 동기화 정상
- [ ] 페이지 이동 시 로딩 스피너 정상 표시
- [ ] 세션 복원 정상
- [ ] 키보드 접근성(Enter/Space) 정상
- [ ] 날짜 확정 및 취소 정상
- [ ] 툴팁(호버) 정상
