import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastCtx = createContext(null)

const BG = {
  success: 'bg-green-600',
  error:   'bg-red-600',
  warning: 'bg-amber-500',
  info:    'bg-blue-600',
}

function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none w-full px-4">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${BG[t.type] ?? BG.info} text-white px-5 py-3 rounded-full shadow-xl text-sm font-medium animate-fade-in-up whitespace-nowrap max-w-sm text-center`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const showToast = useCallback((message, type = 'info') => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const fn = useContext(ToastCtx)
  if (!fn) throw new Error('useToast must be used within ToastProvider')
  return fn
}
