import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { TimeInput } from '@/components/ui/TimeInput'
import type { DayOffMark, DayPlan, EmployeeId, Shift } from '@/domain/types'
import { employeeAccent } from '@/lib/employeeAccent'
import { fi } from '@/i18n/fi'
import { formatHours, shiftHours, toMinutes } from '@/lib/time'
import { useAppStore } from '@/store/useAppStore'

interface Props {
  date: string
  day: DayPlan
}

export function DayEditor({ date, day }: Props) {
  const { settings, updateDay, setTravelDay, setDayOffMark } = useAppStore()

  const headerLabel = useMemo(() => {
    const d = parseISO(date)
    const weekday = fi.weekdaysLong[(d.getDay() + 6) % 7]
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${format(d, 'd.M.yyyy')}`
  }, [date])

  const addShift = (employeeId: EmployeeId) => {
    const fresh: Shift = { employeeId, start: '13:00', end: '19:30' }
    updateDay(date, { shifts: [...day.shifts, fresh] })
  }

  const updateShift = (index: number, patch: Partial<Shift>) => {
    updateDay(date, {
      shifts: day.shifts.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    })
  }

  const removeShift = (index: number) => {
    updateDay(date, { shifts: day.shifts.filter((_, i) => i !== index) })
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-ink-muted">
          Päivän muokkaus
        </p>
        <h3 className="text-lg font-semibold text-ink">{headerLabel}</h3>
      </header>

      <section className="space-y-2 rounded-soft border border-line bg-cream-50 p-3">
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-lavender-400"
            checked={day.isTravelDay}
            onChange={(e) => setTravelDay(date, e.target.checked)}
          />
          <span className="flex flex-col">
            <span className="font-semibold">{fi.travel.toggleLabel}</span>
            <span className="text-xs text-ink-muted">
              {fi.travel.description(
                settings.employees.find((e) => e.id === 'B')?.name ?? 'B',
                settings.employees.find((e) => e.id === 'A')?.name ?? 'A',
              )}
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-3 rounded-soft border border-line bg-cream-50 p-3">
        <h4 className="text-sm font-semibold text-ink">{fi.dayOff.sectionLabel}</h4>
        <div className="grid grid-cols-2 gap-3">
          {settings.employees.map((emp) => {
            const accent = employeeAccent[emp.id]
            const value: DayOffMark = day.dayOffMarks[emp.id]
            return (
              <div key={emp.id} className="rounded-soft bg-paper p-2">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${accent.dot}`}
                  >
                    {emp.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{emp.name}</span>
                </div>
                <DayOffRadio
                  name={`dayoff-${emp.id}`}
                  value={value}
                  onChange={(v) => setDayOffMark(date, emp.id, v)}
                />
              </div>
            )
          })}
        </div>
      </section>

      {settings.employees.map((emp) => {
        const accent = employeeAccent[emp.id]
        const shifts = day.shifts
          .map((s, i) => ({ ...s, _index: i }))
          .filter((s) => s.employeeId === emp.id)
        return (
          <section key={emp.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${accent.dot}`}
                >
                  {emp.name.charAt(0).toUpperCase()}
                </span>
                <h4 className="font-medium text-ink">{emp.name}</h4>
              </div>
              <Button variant="ghost" size="sm" onClick={() => addShift(emp.id)}>
                + {fi.buttons.addShift}
              </Button>
            </div>

            {shifts.length === 0 ? (
              <p className="rounded-soft border border-dashed border-line px-3 py-3 text-sm text-ink-muted">
                Ei vuoroja
              </p>
            ) : (
              <ul className="space-y-2">
                {shifts.map((s) => {
                  const invalid = toMinutes(s.end) <= toMinutes(s.start)
                  return (
                    <li
                      key={s._index}
                      className={`rounded-soft border px-3 py-2 ${accent.bg} ${accent.border}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TimeInput
                          label={fi.shift.start}
                          value={s.start}
                          onChange={(v) => updateShift(s._index, { start: v })}
                          disabled={s.locked}
                        />
                        <TimeInput
                          label={fi.shift.end}
                          value={s.end}
                          onChange={(v) => updateShift(s._index, { end: v })}
                          disabled={s.locked}
                        />
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                            {fi.shift.duration}
                          </span>
                          <span className="flex h-[34px] items-center text-sm tabular-nums text-ink-soft">
                            {invalid ? '—' : formatHours(shiftHours(s.start, s.end))}
                          </span>
                        </div>
                        {s.locked ? (
                          <span className="h-9 w-9 self-end" aria-hidden />
                        ) : (
                          <div className="self-end">
                            <IconButton
                              label={fi.buttons.remove}
                              onClick={() => removeShift(s._index)}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </IconButton>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      <section className="space-y-1">
        <label
          className="text-xs uppercase tracking-wide text-ink-muted"
          htmlFor="day-note"
        >
          {fi.calendar.note}
        </label>
        <textarea
          id="day-note"
          value={day.note}
          onChange={(e) => updateDay(date, { note: e.target.value })}
          rows={4}
          className="w-full rounded-soft border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender-300"
          placeholder="Esim. lääkäri klo 10"
        />
      </section>

      <section className="space-y-1">
        <label
          className="text-xs uppercase tracking-wide text-ink-muted"
          htmlFor="pdf-comment"
        >
          {fi.calendar.pdfComment}
        </label>
        <textarea
          id="pdf-comment"
          value={day.pdfComment}
          onChange={(e) => updateDay(date, { pdfComment: e.target.value })}
          rows={3}
          className="w-full rounded-soft border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lavender-300"
          placeholder="Näkyy työvuorolistan PDF:ssä"
        />
      </section>
    </div>
  )
}

interface RadioProps {
  name: string
  value: DayOffMark
  onChange: (v: DayOffMark) => void
}

function DayOffRadio({ name, value, onChange }: RadioProps) {
  const options: { v: DayOffMark; label: string }[] = [
    { v: null, label: fi.calendar.dayOff.none },
    { v: 'soft', label: fi.calendar.dayOff.soft },
    { v: 'hard', label: fi.calendar.dayOff.hard },
  ]
  return (
    <div className="flex flex-col gap-1 text-xs text-ink-soft">
      {options.map((o) => (
        <label key={String(o.v)} className="flex items-center gap-1.5">
          <input
            type="radio"
            name={name}
            className="h-3.5 w-3.5 accent-lavender-400"
            checked={value === o.v}
            onChange={() => onChange(o.v)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}
