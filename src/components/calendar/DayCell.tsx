import { getDay } from 'date-fns'
import type { DayPlan, EmployeeId } from '@/domain/types'
import { isPublicHoliday } from '@/domain/holidays'
import { employeeAccent } from '@/lib/employeeAccent'
import { useAppStore } from '@/store/useAppStore'
import { fi } from '@/i18n/fi'

interface Props {
  date: Date
  inMonth: boolean
  day: DayPlan | undefined
  onClick: () => void
}

/**
 * Cell background. Only Sundays and Finnish pyhäpäivät are tinted; all other
 * weekdays use plain paper.
 */
function cellBgClass(date: Date, inMonth: boolean): string {
  if (!inMonth) return 'bg-cream-50'
  if (getDay(date) === 0 || isPublicHoliday(date)) return 'bg-cream-100'
  return 'bg-paper'
}

export function DayCell({ date, inMonth, day, onClick }: Props) {
  const { settings } = useAppStore()
  const dayNum = date.getDate()
  const note = day?.note ?? ''

  return (
    <div
      role={inMonth ? 'button' : undefined}
      tabIndex={inMonth ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (inMonth && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={`group flex min-h-[170px] cursor-pointer flex-col p-2 transition ${cellBgClass(
        date,
        inMonth,
      )} ${inMonth ? 'hover:bg-cream-200/40' : 'opacity-40'}`}
    >
      <div className="text-xs leading-snug text-ink-soft">
        <span
          className={`float-right ml-2 text-sm font-semibold tabular-nums ${
            inMonth ? 'text-ink' : 'text-ink-muted'
          }`}
        >
          {dayNum}
        </span>
        {inMonth && day && <TravelBadge day={day} />}
        <span className="line-clamp-6 whitespace-pre-line break-words">
          {note}
        </span>
      </div>

      {inMonth && day && <ShiftsAndDayOffs day={day} employees={settings.employees} />}
    </div>
  )
}

function TravelBadge({ day }: { day: DayPlan }) {
  if (!day.isTravelDay) return null
  return (
    <div className="mb-1">
      <span
        className="inline-block rounded-full bg-butter-200 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-ink"
        title={fi.travel.toggleLabel}
      >
        ✈ {fi.travel.badge}
      </span>
    </div>
  )
}

function ShiftsAndDayOffs({
  day,
  employees,
}: {
  day: DayPlan
  employees: Array<{ id: EmployeeId; name: string }>
}) {
  if (day.shifts.length === 0 && !day.dayOffMarks.A && !day.dayOffMarks.B) {
    return null
  }

  // Sort shifts by start time (earliest first)
  const sortedShifts = [...day.shifts].sort((a, b) => a.start.localeCompare(b.start))

  // Track which employees have shifts
  const employeesWithShifts = new Set(day.shifts.map((s) => s.employeeId))

  return (
    <div className="mt-auto flex flex-col gap-1 pt-1">
      {/* Render shifts in time order */}
      {sortedShifts.map((s, i) => {
        const emp = employees.find((e) => e.id === s.employeeId)
        const accent = employeeAccent[s.employeeId]
        return (
          <div
            key={`shift-${i}`}
            className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium ${accent.bg} ${accent.text}`}
            title={emp?.name}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${accent.dot}`}
            >
              {emp?.name.charAt(0).toUpperCase() ?? s.employeeId}
            </span>
            <span className="tabular-nums">
              {s.start}–{s.end}
            </span>
          </div>
        )
      })}

      {/* Render day-off marks for employees without shifts */}
      {employees.map((emp) => {
        if (employeesWithShifts.has(emp.id)) return null // Skip if employee has a shift
        const dayOffMark = day.dayOffMarks[emp.id]
        if (!dayOffMark) return null // Skip if no day-off mark

        return (
          <div
            key={`${emp.id}-dayoff`}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
              dayOffMark === 'hard' ? 'bg-red-200 text-red-900' : 'bg-orange-100 text-orange-700'
            }`}
            title={
              dayOffMark === 'hard'
                ? fi.dayOff.badge.hard
                : fi.dayOff.badge.soft
            }
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${dayOffMark === 'hard' ? 'bg-red-700' : 'bg-orange-500'}`}
            >
              {emp.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )
      })}
    </div>
  )
}
