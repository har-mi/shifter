import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns'
import type { DayPlan, MonthPlan } from '@/domain/types'

/** Build a brand-new empty month plan for the given year/month (1-12). */
export function emptyMonthPlan(year: number, month: number): MonthPlan {
  const first = new Date(year, month - 1, 1)
  const days: DayPlan[] = eachDayOfInterval({
    start: startOfMonth(first),
    end: endOfMonth(first),
  }).map((d) => ({
    date: format(d, 'yyyy-MM-dd'),
    shifts: [],
    note: '',
    pdfComment: '',
    isTravelDay: false,
    dayOffMarks: { A: null, B: null },
  }))
  return { year, month, days }
}
