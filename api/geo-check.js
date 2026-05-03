export const config = { runtime: 'edge' }

export default function handler(request) {
  const country = request.geo?.country

  // geo 정보 없음 = 로컬 개발 환경 → 통과
  if (!country) {
    return Response.json({ allowed: true })
  }

  if (country !== 'KR') {
    return Response.json(
      { error: 'KR_ONLY', message: '이 서비스는 대한민국에서만 사용 가능합니다.' },
      { status: 403 }
    )
  }

  return Response.json({ allowed: true })
}
