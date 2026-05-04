import { PARTICIPANT_COLORS } from './constants'

// 숫자 4자리 PIN 형식 검증 — true: 유효, false: 무효
export function validatePin(pin) {
  return /^\d{4}$/.test(pin)
}

// 등록 순서(index)에 따른 색상 자동 배정
export function assignColor(index) {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]
}

export function isRoomFull(participants, maxParticipants) {
  return participants.length >= maxParticipants
}
