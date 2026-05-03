import { useEffect, useState } from 'react'

export default function GeoGuard({ children }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'allowed' | 'blocked'

  useEffect(() => {
    fetch('/api/geo-check')
      .then(res => res.json())
      .then(data => {
        setStatus(data.allowed ? 'allowed' : 'blocked')
      })
      .catch(() => {
        // 네트워크 오류 시 통과 (서비스 가용성 우선)
        setStatus('allowed')
      })
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'blocked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-10 max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">🇰🇷</div>
          <h1 className="text-lg font-bold text-gray-800">
            이 서비스는 대한민국에서만 이용할 수 있습니다.
          </h1>
          <p className="text-sm text-gray-500">
            This service is only available in South Korea.
          </p>
        </div>
      </div>
    )
  }

  return children
}
