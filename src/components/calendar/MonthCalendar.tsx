import { useMemo } from 'react'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { DayCell } from './DayCell'
import { useAppStore } from '@/store/useAppStore'
import { fi } from '@/i18n/fi'

interface Props {
  onSelectDay: (isoDate: string) => void
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Monday-first 7-column month grid with an ISO week-number column on the
 * left. Leak-in days from neighbouring months are greyed out so the grid is
 * always rectangular.
 */
export function MonthCalendar({ onSelectDay }: Props) {
  const { monthPlan } = useAppStore()
  const monthDate = new Date(monthPlan.year, monthPlan.month - 1, 1)

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 })
    return chunk(eachDayOfInterval({ start, end }), 7)
  }, [monthDate])

  const byDate = useMemo(
    () => new Map(monthPlan.days.map((d) => [d.date, d])),
    [monthPlan.days],
  )

  return (
    <div className="overflow-hidden rounded-soft border border-line bg-paper shadow-soft">
      <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] border-b border-line bg-cream-100">
        <div className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          {fi.calendar.weekShort}
        </div>
        {fi.weekdaysShort.map((w, i) => (
          <div
            key={w}
            className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide ${
              i >= 5 ? 'text-ink-muted' : 'text-ink-soft'
            }`}
          >
            {w}
          </div>
        ))}
      </div>
      <div>
        {weeks.map((week) => (
          <div
            key={format(week[0], 'yyyy-MM-dd')}
            className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] border-t border-line first:border-t-0"
          >
            <div className="flex items-start justify-center border-r border-line bg-cream-100/60 px-2 pt-2 text-[11px] font-semibold tabular-nums text-ink-muted">
              {getISOWeek(week[0])}
            </div>
            {week.map((d) => {
              const iso = format(d, 'yyyy-MM-dd')
              const inMonth = isSameMonth(d, monthDate)
              return (
                <div
                  key={iso}
                  className="border-r border-line last:border-r-0"
                >
                  <DayCell
                    date={d}
                    inMonth={inMonth}
                    day={byDate.get(iso)}
                    onClick={() => inMonth && onSelectDay(iso)}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
