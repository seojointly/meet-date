// Individual toast item — consumed by ToastContext
const BG = {
  success: 'bg-green-600',
  error:   'bg-red-600',
  warning: 'bg-amber-500',
  info:    'bg-blue-600',
}

export default function Toast({ message, type = 'info' }) {
  return (
    <div
      className={`${BG[type] ?? BG.info} text-white px-5 py-3 rounded-full shadow-xl text-sm font-medium animate-fade-in-up whitespace-nowrap max-w-sm text-center`}
    >
      {message}
    </div>
  )
}
