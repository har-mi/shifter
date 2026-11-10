import { getDay, getISOWeek, parseISO } from 'date-fns'
import { isPlannerHoliday } from '@/domain/holidays'
import type {
  DayPlan,
  Employee,
  EmployeeId,
  MonthPlan,
  PreferredShift,
  Settings,
  Shift,
} from '@/domain/types'
import {
  fromMinutes,
  shiftHours,
  toMinutes,
  totalHours,
} from '@/lib/time'

/**
 * Weekday preference (higher = filled first). Sundays come FIRST because
 * each Sunday is pre-assigned to exactly one employee, so they should be
 * allocated before the abundant Mon/Wed/Thu pool fills the target. Tue and
 * Sat default to 0 (last-resort fallback). JS `getDay()` uses 0 = Sunday.
 */
const PREFERENCE: Record<number, number> = {
  0: 7, // Sun (pre-assigned per the 60/40 rule, must be allocated first)
  1: 5, // Mon
  3: 5, // Wed
  4: 5, // Thu
  5: 2, // Fri
  2: 0, // Tue
  6: 0, // Sat
}

const TOP_UP_CAP = 1000

/**
 * Pure greedy planner. Preserves shifts marked `locked` (e.g. travel-day
 * pre-fills); regenerates everything else for both employees.
 *
 *   1. Wipe non-locked shifts.
 *   2. Pre-assign Sundays per the A-favoured split.
 *   3. Iterate weekday-preference buckets [Sun, Mon/Wed/Thu, Fri, Tue/Sat].
 *      Within each bucket, walk days in date order and pick the employee
 *      whose biweekly shift count is lower (ties broken by who has more
 *      remaining hours, proportionally). Sundays are pinned to their
 *      pre-assigned owner.
 *   4. Top-up: lengthen the latest planner-added shift per employee in
 *      15-min steps inside the configured work window, hard-capped at
 *      TOP_UP_CAP iterations so the function always terminates.
 *
 * No backtracking. Any unmet target surfaces as a `hours_under` /
 * `hours_over` violation via `validate()` on render.
 */
export function autoPlan(plan: MonthPlan, settings: Settings): MonthPlan {
  const days: DayPlan[] = plan.days.map((d) => ({
    ...d,
    shifts: d.shifts.filter((s) => s.locked),
  }))
  const next: MonthPlan = { ...plan, days }

  const sundayOwner = assignSundays(next)
  scheduleInterleaved(next, settings, sundayOwner)

  for (const emp of settings.employees) {
    topUpEmployee(next, emp, settings)
  }
  return next
}

/**
 * Pre-assign each Sunday of the month, favouring A. The split is:
 *   1 Sunday  → 1A / 0B
 *   2 Sundays → 1A / 1B
 *   3 Sundays → 2A / 1B
 *   4 Sundays → 3A / 1B
 *   5 Sundays → 3A / 2B
 *   N Sundays → (N - floor(N/2))A / floor(N/2)B
 * The order alternates A,B,A,B,… then any remaining slots default to A,
 * which gives perfect alternation when possible (5 → A,B,A,B,A) and the
 * closest possible spread otherwise (4 → A,B,A,A).
 */
function assignSundays(plan: MonthPlan): Map<string, EmployeeId> {
  const result = new Map<string, EmployeeId>()
  const sundays = plan.days.filter(
    (d) =>
      getDay(parseISO(d.date)) === 0 &&
      d.shifts.length === 0 &&
      !isPlannerHoliday(parseISO(d.date)),
  )
  const n = sundays.length
  const bCount = Math.max(0, Math.floor((n - 1) / 2))
  const owners: EmployeeId[] = Array(n).fill('A')
  for (let i = 0; i < bCount; i++) {
    owners[2 * i + 1] = 'B'
  }
  sundays.forEach((d, i) => result.set(d.date, owners[i]))
  return result
}

/** True if the current plan has any shift that the planner is allowed to overwrite. */
export function hasOverwritableShifts(plan: MonthPlan): boolean {
  return plan.days.some((d) => d.shifts.some((s) => !s.locked))
}

// ---------------------------------------------------------------------------

function scheduleInterleaved(
  plan: MonthPlan,
  settings: Settings,
  sundayOwner: Map<string, EmployeeId>,
): void {
  const empById = new Map<EmployeeId, Employee>(
    settings.employees.map((e) => [e.id, e]),
  )
  const minShiftH = settings.minShiftMinutes / 60

  // Bucket scores match PREFERENCE: 7 = Sun (pre-assigned), 5 = Mon/Wed/Thu,
  // 2 = Fri, 0 = Tue/Sat (fallback).
  const buckets = [7, 5, 2, 0]
  for (const score of buckets) {
    const pool = plan.days
      .filter((d) => d.shifts.length === 0)
      .filter((d) => !isPlannerHoliday(parseISO(d.date)))
      .filter((d) => PREFERENCE[getDay(parseISO(d.date))] === score)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))

    for (const day of pool) {
      const candidates: EmployeeId[] =
        score === 7
          ? sundayCandidatesFor(day, sundayOwner, settings)
          : settings.employees.map((e) => e.id)
      const pick = chooseBalancedEmployee(plan, day, candidates, empById, minShiftH)
      if (!pick) continue
      const emp = empById.get(pick)
      if (!emp) continue
      const remainingH = emp.monthlyHours - currentHours(plan, pick)
      tryAddShift(plan, day, emp, settings, remainingH, minShiftH)
    }
  }
}

/**
 * Sunday assignment honours its pre-assigned owner unless that employee has
 * a hard day-off mark — in which case the slot transfers to the other
 * employee (or stays empty if both refuse).
 */
function sundayCandidatesFor(
  day: DayPlan,
  sundayOwner: Map<string, EmployeeId>,
  settings: Settings,
): EmployeeId[] {
  const primary = sundayOwner.get(day.date)
  if (!primary) return []
  if (day.dayOffMarks[primary] !== 'hard') return [primary]
  const other = settings.employees.find((e) => e.id !== primary)?.id
  if (other && day.dayOffMarks[other] !== 'hard') return [other]
  return []
}

/**
 * Pick the employee for `day` that best preserves a balanced workload
 * across each 2-week window. Falls back to remaining-hour slack on ties.
 */
function chooseBalancedEmployee(
  plan: MonthPlan,
  day: DayPlan,
  candidates: EmployeeId[],
  empById: Map<EmployeeId, Employee>,
  minShiftH: number,
): EmployeeId | null {
  const eligible = candidates.filter((id) => {
    const emp = empById.get(id)
    if (!emp) return false
    const remainingH = emp.monthlyHours - currentHours(plan, id)
    if (remainingH < minShiftH - 1e-9) return false
    if (day.dayOffMarks[id] === 'hard') return false
    return fitsRestRule(plan, id, day.date)
  })
  if (eligible.length === 0) return null

  // Hard alternation cap: no employee may exceed 4 same-employee shifts in
  // a row (counting only shift-days, not rest days). Drop candidates that
  // would break this. If both candidates would break it, the day is left
  // empty rather than violating the rule.
  const withinAlternation = eligible.filter(
    (id) => !wouldExceedAlternationRun(plan, id, day.date, 4),
  )
  const pool = withinAlternation.length > 0 ? withinAlternation : []
  if (pool.length === 0) return null
  if (pool.length === 1) return pool[0]

  // Soft day-off: prefer candidates who didn't ask for the day off.
  const withoutSoft = pool.filter((id) => day.dayOffMarks[id] !== 'soft')
  const finalPool = withoutSoft.length > 0 ? withoutSoft : pool
  if (finalPool.length === 1) return finalPool[0]

  const bw = biWeekOf(day.date)
  const stats = finalPool.map((id) => {
    const emp = empById.get(id)!
    const bwCount = biWeekShiftCount(plan, id, bw)
    const remainingH = emp.monthlyHours - currentHours(plan, id)
    const slack = remainingH / emp.monthlyHours
    return { id, bwCount, slack }
  })
  stats.sort((a, b) => {
    if (a.bwCount !== b.bwCount) return a.bwCount - b.bwCount
    if (a.slack !== b.slack) return b.slack - a.slack
    return a.id.localeCompare(b.id)
  })
  return stats[0].id
}

function biWeekOf(iso: string): number {
  return Math.floor((getISOWeek(parseISO(iso)) - 1) / 2)
}

function biWeekShiftCount(plan: MonthPlan, empId: EmployeeId, bw: number): number {
  let n = 0
  for (const d of plan.days) {
    if (biWeekOf(d.date) !== bw) continue
    if (hasShift(d, empId)) n++
  }
  return n
}

/**
 * True if assigning `empId` on `candidateDate` would produce a run of more
 * than `maxRun` consecutive shift-days for the same employee (rest days
 * don't break the run — only a shift by the other employee does).
 */
function wouldExceedAlternationRun(
  plan: MonthPlan,
  empId: EmployeeId,
  candidateDate: string,
  maxRun: number,
): boolean {
  let before = 0
  for (let i = plan.days.length - 1; i >= 0; i--) {
    const d = plan.days[i]
    if (d.date >= candidateDate) continue
    if (d.shifts.length === 0) continue
    if (d.shifts.every((s) => s.employeeId === empId)) before += 1
    else break
  }
  let after = 0
  for (const d of plan.days) {
    if (d.date <= candidateDate) continue
    if (d.shifts.length === 0) continue
    if (d.shifts.every((s) => s.employeeId === empId)) after += 1
    else break
  }
  return before + 1 + after > maxRun
}

function topUpEmployee(plan: MonthPlan, emp: Employee, settings: Settings): void {
  let hoursH = currentHours(plan, emp.id)
  const targetH = emp.monthlyHours
  if (hoursH >= targetH) return
  let iters = 0
  while (hoursH < targetH - 1e-9 && iters++ < TOP_UP_CAP) {
    const last = lastExtendableShift(plan, emp.id, settings.workWindow.end)
    if (!last) break
    last.end = fromMinutes(toMinutes(last.end) + 15)
    hoursH += 0.25
  }
}

function tryAddShift(
  plan: MonthPlan,
  day: DayPlan,
  emp: Employee,
  settings: Settings,
  remainingH: number,
  minShiftH: number,
): void {
  if (!fitsRestRule(plan, emp.id, day.date)) return

  const base = preferredShiftFor(day.date, settings)
  let start = base.start
  let end = base.end
  const shiftH = shiftHours(start, end)

  if (shiftH > remainingH + 1e-9) {
    // Would overshoot the monthly target — shrink the shift, but never below
    // the minimum-shift threshold. If we can't fit even the minimum, skip.
    if (remainingH < minShiftH - 1e-9) return
    const startMin = toMinutes(start)
    // Round DOWN to a 15-min boundary so we never exceed the target.
    const newLenMin = Math.floor(remainingH * 4) * 15
    if (newLenMin < settings.minShiftMinutes) return
    end = fromMinutes(startMin + newLenMin)
  }

  day.shifts.push({ employeeId: emp.id, start, end })
}

function preferredShiftFor(iso: string, settings: Settings): { start: string; end: string } {
  const date = parseISO(iso)
  const weekdayIso = ((getDay(date) + 6) % 7) + 1 // Mon=1 … Sun=7
  const candidates = settings.preferredShifts.filter((p: PreferredShift) =>
    p.weekdays.includes(weekdayIso),
  )
  if (candidates.length === 0) return { start: '13:00', end: '19:30' }
  // Deterministic rotation by day-of-month so shifts vary across the calendar.
  const pick = candidates[(date.getDate() - 1) % candidates.length]
  return { start: pick.start, end: pick.end }
}

function lastExtendableShift(
  plan: MonthPlan,
  empId: EmployeeId,
  workEnd: string,
): Shift | null {
  const limit = toMinutes(workEnd)
  for (let i = plan.days.length - 1; i >= 0; i--) {
    const day = plan.days[i]
    for (let j = day.shifts.length - 1; j >= 0; j--) {
      const s = day.shifts[j]
      if (s.employeeId !== empId || s.locked) continue
      if (toMinutes(s.end) + 15 <= limit) return s
    }
  }
  return null
}

/** True if adding a work day at `candidateDate` keeps the 4-then-2 rest rule. */
function fitsRestRule(plan: MonthPlan, empId: EmployeeId, candidateDate: string): boolean {
  const work = new Set<string>()
  for (const d of plan.days) {
    if (hasShift(d, empId)) work.add(d.date)
  }
  work.add(candidateDate)

  let streak = 0
  let pendingRest = 0
  for (const d of plan.days) {
    if (work.has(d.date)) {
      if (pendingRest > 0) return false
      streak += 1
      if (streak > 4) return false
      if (streak === 4) pendingRest = 2
    } else {
      if (pendingRest > 0) pendingRest -= 1
      streak = 0
    }
  }
  return true
}

function hasShift(day: DayPlan, empId: EmployeeId): boolean {
  return day.shifts.some((s) => s.employeeId === empId)
}

function currentHours(plan: MonthPlan, empId: EmployeeId): number {
  return totalHours(plan.days.flatMap((d) => d.shifts.filter((s) => s.employeeId === empId)))
}
