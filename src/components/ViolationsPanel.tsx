import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import type { Violation } from '@/domain/types'
import { employeeAccent } from '@/lib/employeeAccent'
import { fi } from '@/i18n/fi'
import { useAppStore } from '@/store/useAppStore'

interface Props {
  violations: Violation[]
  onJumpToDay: (iso: string) => void
}

/**
 * Inline panel listing every rule the current month breaks. Hour totals
 * always come first (per employee), then per-day issues in chronological
 * order. Each day-bound row has a "jump to day" affordance that opens the
 * DayEditor drawer on the offending date.
 */
export function ViolationsPanel({ violations, onJumpToDay }: Props) {
  const { settings } = useAppStore()
  const empName = (id?: string) =>
    settings.employees.find((e) => e.id === id)?.name ?? ''

  const grouped = useMemo(() => {
    const monthLevel = violations.filter((v) => !v.date)
    const dayLevel = violations
      .filter((v) => v.date)
      .slice()
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))
    return { monthLevel, dayLevel }
  }, [violations])

  if (violations.length === 0) {
    return (
      <div className="rounded-soft border border-line bg-sage-100 px-4 py-3 text-sm text-sage-700">
        {fi.violations.none}
      </div>
    )
  }

  return (
    <div className="rounded-soft border border-line bg-paper shadow-soft">
      <header className="border-b border-line px-4 py-2 text-sm font-semibold text-ink">
        {fi.violations.title}
      </header>

      {grouped.monthLevel.length > 0 && (
        <section className="border-b border-line px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {fi.violations.summaryPerMonth}
          </p>
          <ul className="space-y-1.5">
            {grouped.monthLevel.map((v, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <EmpDot id={v.employeeId} />
                <span className="text-ink">{v.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grouped.dayLevel.length > 0 && (
        <ul className="divide-y divide-line">
          {grouped.dayLevel.map((v, i) => {
            const d = parseISO(v.date!)
            return (
              <li key={i} className="flex items-start gap-3 px-4 py-2 text-sm">
                <EmpDot id={v.employeeId} />
                <button
                  type="button"
                  onClick={() => onJumpToDay(v.date!)}
                  className="min-w-[80px] text-left text-ink-soft tabular-nums underline-offset-2 hover:text-lavender-500 hover:underline"
                  title={fi.violations.jumpTo}
                >
                  {format(d, 'd.M.')}{' '}
                  <span className="text-xs text-ink-muted">
                    {fi.weekdaysShort[(d.getDay() + 6) % 7]}
                  </span>
                </button>
                <span className="flex-1 text-ink">
                  {v.message.replace(`${empName(v.employeeId)}: `, '')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function EmpDot({ id }: { id?: string }) {
  if (id !== 'A' && id !== 'B') {
    return (
      <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-ink-muted/40" aria-hidden />
    )
  }
  const accent = employeeAccent[id]
  return (
    <span
      className={`mt-1 h-3 w-3 shrink-0 rounded-full ${accent.dot}`}
      aria-label={id}
    />
  )
}
