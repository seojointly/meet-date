import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'
import HomePage from './pages/HomePage'
import VotePage from './pages/VotePage'
import ConfirmedPage from './pages/ConfirmedPage'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/vote/:roomId" element={<VotePage />} />
          <Route path="/confirmed/:roomId" element={<ConfirmedPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
