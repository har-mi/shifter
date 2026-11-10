import { useEffect, type ReactNode } from 'react'
import { IconButton } from './IconButton'
import { fi } from '@/i18n/fi'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Width in tailwind units; default ~400px. */
  widthClass?: string
}

/**
 * Right-side slide-over drawer. Backdrop is intentionally light/non-modal so
 * the calendar stays clickable behind it — the user can switch days without
 * closing.
 */
export function Drawer({ open, onClose, title, children, widthClass = 'w-[480px]' }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-ink/20 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        aria-hidden={!open}
        className={`pointer-events-none fixed right-0 top-0 z-40 h-full transition-transform duration-200 ease-out ${widthClass} ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="pointer-events-auto flex h-full flex-col bg-paper shadow-soft border-l border-line">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <IconButton label={fi.buttons.close} onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </IconButton>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </aside>
    </>
  )
}
