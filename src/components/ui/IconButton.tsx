import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
}

export function IconButton({ label, className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-cream-100 active:bg-cream-200 disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
