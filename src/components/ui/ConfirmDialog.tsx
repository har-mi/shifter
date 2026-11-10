import { useCallback } from 'react'
import { Button } from './Button'
import { fi } from '@/i18n/fi'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const focusConfirm = useCallback((node: HTMLButtonElement | null) => {
    node?.focus()
  }, [])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-soft bg-paper shadow-soft border border-line p-6"
      >
        <h2 id="confirm-title" className="mb-2 text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="mb-6 text-ink-soft">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel ?? fi.buttons.cancel}
          </Button>
          <button
            ref={focusConfirm}
            type="button"
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-soft px-4 py-2 font-medium shadow-soft transition ${
              destructive
                ? 'bg-red-100 text-red-800 hover:bg-red-200'
                : 'bg-lavender-400 text-white hover:bg-lavender-500'
            }`}
          >
            {confirmLabel ?? fi.buttons.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
