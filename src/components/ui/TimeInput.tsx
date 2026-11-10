import { useEffect, useId, useState } from 'react'
import { fromMinutes, snapToQuarter, toMinutes } from '@/lib/time'

interface Props {
  label?: string
  value: string
  onChange: (next: string) => void
  /** Inclusive minimum, HH:MM. */
  min?: string
  /** Inclusive maximum, HH:MM. */
  max?: string
  disabled?: boolean
}

const QUARTER = 15
const HHMM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/

/**
 * 15-minute stepper time input. Renders as a plain text field so the value
 * is always shown in 24-hour HH:MM regardless of the user's OS locale —
 * native `<input type="time">` switches to AM/PM on en-US Macs, which we
 * don't want for a Finnish UI. ± buttons snap to the 15-min grid.
 */
export function TimeInput({ label, value, onChange, min, max, disabled }: Props) {
  const id = useId()
  const [draft, setDraft] = useState(value)

  // Keep local draft in sync when the outer value changes (e.g. via stepper).
  useEffect(() => {
    setDraft(value)
  }, [value])

  const clamp = (next: string) => {
    let m = toMinutes(next)
    if (min) m = Math.max(m, toMinutes(min))
    if (max) m = Math.min(m, toMinutes(max))
    return fromMinutes(m)
  }

  const commit = (raw: string) => {
    if (!HHMM_RE.test(raw)) {
      setDraft(value) // revert
      return
    }
    const next = clamp(snapToQuarter(raw))
    setDraft(next)
    if (next !== value) onChange(next)
  }

  const step = (deltaMin: number) => () => {
    const next = fromMinutes(toMinutes(value) + deltaMin)
    onChange(clamp(snapToQuarter(next)))
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <label
          htmlFor={id}
          className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted"
        >
          {label}
        </label>
      )}
      <div className="flex items-stretch overflow-hidden rounded-soft border border-line bg-paper">
        <button
          type="button"
          onClick={step(-QUARTER)}
          disabled={disabled}
          className="px-2 text-ink-soft hover:bg-cream-100 disabled:opacity-40"
          aria-label="-15 min"
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          placeholder="HH:MM"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="w-16 bg-transparent px-2 py-1.5 text-center text-ink tabular-nums focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={step(QUARTER)}
          disabled={disabled}
          className="px-2 text-ink-soft hover:bg-cream-100 disabled:opacity-40"
          aria-label="+15 min"
        >
          +
        </button>
      </div>
    </div>
  )
}
