import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'

const HomePage      = lazy(() => import('./pages/HomePage'))
const VotePage      = lazy(() => import('./pages/VotePage'))
const ConfirmedPage = lazy(() => import('./pages/ConfirmedPage'))

const pageSpinner = (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={pageSpinner}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/vote/:roomId" element={<VotePage />} />
            <Route path="/confirmed/:roomId" element={<ConfirmedPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  )
}
