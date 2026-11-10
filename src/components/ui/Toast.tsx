import { useEffect } from 'react'

export interface ToastMessage {
  id: number
  text: string
  tone?: 'info' | 'success' | 'warn' | 'error'
}

interface Props {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}

const TONE: Record<NonNullable<ToastMessage['tone']>, string> = {
  info: 'bg-paper text-ink border-line',
  success: 'bg-sage-100 text-sage-500 border-sage-200',
  warn: 'bg-butter-200 text-ink border-butter-300',
  error: 'bg-red-100 text-red-800 border-red-200',
}

export function ToastStack({ toasts, onDismiss }: Props) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000)
    return () => clearTimeout(id)
  }, [onDismiss])
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`pointer-events-auto rounded-soft border px-4 py-2 shadow-soft ${TONE[toast.tone ?? 'info']}`}
    >
      {toast.text}
    </div>
  )
}
