export const config = { runtime: 'edge' }

export default function handler(request) {
  const country = request.geo?.country
  if (!country || country === 'KR') {
    return new Response(JSON.stringify({ allowed: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  return new Response(
    JSON.stringify({
      error: 'KR_ONLY',
      message: '이 서비스는 대한민국에서만 사용 가능합니다.'
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}
