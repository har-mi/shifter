import { describe, expect, it } from 'vitest'
import { autoPlan, hasOverwritableShifts } from './autoPlan'
import { emptyMonthPlan } from '@/domain/monthPlan'
import { validate } from '@/domain/constraints'
import { DEFAULT_SETTINGS } from '@/config/defaults'
import { totalHours } from '@/lib/time'
import type { MonthPlan } from '@/domain/types'
import { getISOWeek, parseISO } from 'date-fns'

const hoursFor = (plan: MonthPlan, id: 'A' | 'B') =>
  totalHours(plan.days.flatMap((d) => d.shifts.filter((s) => s.employeeId === id)))

describe('autoPlan', () => {
  it('hits exact monthly targets on a regular month (June 2026, 30 days)', () => {
    const out = autoPlan(emptyMonthPlan(2026, 6), DEFAULT_SETTINGS)
    expect(hoursFor(out, 'A')).toBeCloseTo(70, 5)
    expect(hoursFor(out, 'B')).toBeCloseTo(69, 5)
  })

  it('produces no rest-rule or overlap violations', () => {
    const out = autoPlan(emptyMonthPlan(2026, 10), DEFAULT_SETTINGS)
    const v = validate(out, DEFAULT_SETTINGS)
    expect(v.filter((x) => x.code === 'rest_rule_broken')).toHaveLength(0)
    expect(v.filter((x) => x.code === 'overlapping_shifts')).toHaveLength(0)
    expect(v.filter((x) => x.code === 'shift_too_short')).toHaveLength(0)
  })

  it('skips planner holidays (December: 24, 25 + Christmas season)', () => {
    const out = autoPlan(emptyMonthPlan(2026, 12), DEFAULT_SETTINGS)
    const days = out.days
    const dec24 = days.find((d) => d.date === '2026-12-24')!
    const dec25 = days.find((d) => d.date === '2026-12-25')!
    expect(dec24.shifts).toHaveLength(0)
    expect(dec25.shifts).toHaveLength(0)
  })

  it('preserves locked shifts and plans around them', () => {
    const plan = emptyMonthPlan(2026, 6)
    plan.days[0].shifts.push({
      employeeId: 'A',
      start: '06:30',
      end: '09:00',
      locked: true,
    })
    const out = autoPlan(plan, DEFAULT_SETTINGS)
    const firstDay = out.days[0].shifts.filter((s) => s.employeeId === 'A')
    expect(firstDay).toHaveLength(1)
    expect(firstDay[0].locked).toBe(true)
    expect(firstDay[0].start).toBe('06:30')
    expect(hoursFor(out, 'A')).toBeCloseTo(70, 5)
  })

  it('discards previous non-locked shifts on re-plan', () => {
    const plan = emptyMonthPlan(2026, 6)
    // Random user-added (non-locked) shift; should be wiped before replanning.
    plan.days[15].shifts.push({ employeeId: 'A', start: '07:00', end: '12:00' })
    const out = autoPlan(plan, DEFAULT_SETTINGS)
    expect(hoursFor(out, 'A')).toBeCloseTo(70, 5)
  })

  it('hasOverwritableShifts reflects only non-locked shifts', () => {
    const plan = emptyMonthPlan(2026, 6)
    expect(hasOverwritableShifts(plan)).toBe(false)
    plan.days[0].shifts.push({
      employeeId: 'A',
      start: '06:30',
      end: '09:00',
      locked: true,
    })
    expect(hasOverwritableShifts(plan)).toBe(false)
    plan.days[1].shifts.push({ employeeId: 'A', start: '13:00', end: '19:30' })
    expect(hasOverwritableShifts(plan)).toBe(true)
  })

  it('terminates and is idempotent (running twice produces same hours)', () => {
    const a = autoPlan(emptyMonthPlan(2026, 2), DEFAULT_SETTINGS) // Feb non-leap
    const b = autoPlan(a, DEFAULT_SETTINGS)
    expect(hoursFor(b, 'A')).toBeCloseTo(hoursFor(a, 'A'), 5)
    expect(hoursFor(b, 'B')).toBeCloseTo(hoursFor(a, 'B'), 5)
  })

  it('splits Sundays in A\u2019s favour with alternation', () => {
    // March 2026 has 5 Sundays: 1, 8, 15, 22, 29 -> A,B,A,B,A.
    const m3 = autoPlan(emptyMonthPlan(2026, 3), DEFAULT_SETTINGS)
    const sundays3 = m3.days.filter((d) => new Date(d.date).getDay() === 0)
    const owners3 = sundays3.map((d) => d.shifts[0]?.employeeId ?? null)
    expect(owners3).toEqual(['A', 'B', 'A', 'B', 'A'])

    // July 2026 has 4 Sundays: 5, 12, 19, 26 -> A,B,A,A (3 A / 1 B).
    const m7 = autoPlan(emptyMonthPlan(2026, 7), DEFAULT_SETTINGS)
    const sundays7 = m7.days.filter((d) => new Date(d.date).getDay() === 0)
    const owners7 = sundays7.map((d) => d.shifts[0]?.employeeId ?? null)
    expect(owners7).toEqual(['A', 'B', 'A', 'A'])
  })

  it('spreads each employee across the month (no front/back loading)', () => {
    // Both employees should appear in the first AND second half of the month.
    const out = autoPlan(emptyMonthPlan(2026, 6), DEFAULT_SETTINGS)
    const firstHalf = out.days.filter((d) => parseISO(d.date).getDate() <= 15)
    const secondHalf = out.days.filter((d) => parseISO(d.date).getDate() > 15)
    const has = (days: typeof out.days, id: 'A' | 'B') =>
      days.some((d) => d.shifts.some((s) => s.employeeId === id))
    expect(has(firstHalf, 'A')).toBe(true)
    expect(has(firstHalf, 'B')).toBe(true)
    expect(has(secondHalf, 'A')).toBe(true)
    expect(has(secondHalf, 'B')).toBe(true)
  })

  it('balances shifts per 2-week window within tolerance', () => {
    // For each biweekly window, neither employee should dominate by more
    // than a couple of shifts (Sunday pre-assignment can skew by 1).
    const out = autoPlan(emptyMonthPlan(2026, 6), DEFAULT_SETTINGS)
    const byBiWeek = new Map<number, { A: number; B: number }>()
    for (const d of out.days) {
      const bw = Math.floor((getISOWeek(parseISO(d.date)) - 1) / 2)
      const bucket = byBiWeek.get(bw) ?? { A: 0, B: 0 }
      for (const s of d.shifts) bucket[s.employeeId] += 1
      byBiWeek.set(bw, bucket)
    }
    for (const counts of byBiWeek.values()) {
      // Skip near-empty buckets (e.g. a single trailing week from the
      // prior/next month spillover) where balance is trivially fine.
      if (counts.A + counts.B < 3) continue
      expect(Math.abs(counts.A - counts.B)).toBeLessThanOrEqual(2)
    }
  })

  it('uses only the 11:00\u201318:30 template on Sundays', () => {
    const out = autoPlan(emptyMonthPlan(2026, 3), DEFAULT_SETTINGS)
    const sundayShifts = out.days
      .filter((d) => new Date(d.date).getDay() === 0)
      .flatMap((d) => d.shifts)
      .filter((s) => !s.locked)
    expect(sundayShifts.length).toBeGreaterThan(0)
    for (const s of sundayShifts) {
      expect(s.start).toBe('11:00')
      // End may have been extended by top-up, but must start at or after 18:30.
      expect(s.end >= '18:30').toBe(true)
    }
  })

  it('draws from multiple shift templates across the month', () => {
    const out = autoPlan(emptyMonthPlan(2026, 6), DEFAULT_SETTINGS)
    const starts = new Set(
      out.days
        .flatMap((d) => d.shifts)
        .filter((s) => !s.locked)
        .map((s) => s.start),
    )
    // We should see at least two distinct start times across the month.
    expect(starts.size).toBeGreaterThanOrEqual(2)
  })

  it('never produces a same-employee run longer than 4 shift-days', () => {
    for (const month of [3, 6, 7, 10, 12]) {
      const out = autoPlan(emptyMonthPlan(2026, month), DEFAULT_SETTINGS)
      const v = validate(out, DEFAULT_SETTINGS).filter(
        (x) => x.code === 'alternation_run_too_long',
      )
      expect(v, `month ${month} should have no alternation violations`).toHaveLength(0)
    }
  })

  it('preserves travel-day locked shifts and plans around them', () => {
    const plan = emptyMonthPlan(2026, 6)
    plan.days[7].isTravelDay = true
    plan.days[7].shifts.push({ employeeId: 'B', start: '06:30', end: '09:00', locked: true })
    plan.days[7].shifts.push({ employeeId: 'A', start: '15:00', end: '20:30', locked: true })
    const out = autoPlan(plan, DEFAULT_SETTINGS)
    const travel = out.days[7].shifts.filter((s) => s.locked)
    // The 2 travel shifts should still be present and untouched.
    expect(travel).toHaveLength(2)
    const v = validate(out, DEFAULT_SETTINGS).filter(
      (x) => x.code === 'travel_day_shift_missing',
    )
    expect(v).toHaveLength(0)
  })

  it('respects a hard day-off mark', () => {
    const plan = emptyMonthPlan(2026, 6)
    // Mark a Wednesday (likely prime weekday) as hard-off for A.
    const wed = plan.days.find((d) => new Date(d.date).getDay() === 3)!
    wed.dayOffMarks = { A: 'hard', B: null }
    const out = autoPlan(plan, DEFAULT_SETTINGS)
    const outDay = out.days.find((d) => d.date === wed.date)!
    expect(outDay.shifts.some((s) => s.employeeId === 'A')).toBe(false)
    const v = validate(out, DEFAULT_SETTINGS).filter(
      (x) => x.code === 'hard_day_off_violated',
    )
    expect(v).toHaveLength(0)
  })

  it('prefers the unmarked employee over a soft day-off mark', () => {
    const plan = emptyMonthPlan(2026, 6)
    // A Monday with a soft mark for A — when both employees are eligible
    // and tied otherwise, B should win.
    const mon = plan.days.find((d) => new Date(d.date).getDay() === 1)!
    mon.dayOffMarks = { A: 'soft', B: null }
    const out = autoPlan(plan, DEFAULT_SETTINGS)
    const outDay = out.days.find((d) => d.date === mon.date)!
    // Either B is assigned, or the day is empty (if rest rule forbids).
    // It must NOT be A.
    expect(outDay.shifts.some((s) => s.employeeId === 'A')).toBe(false)
  })

  it('reassigns Sundays when the pre-owner has a hard day-off', () => {
    const plan = emptyMonthPlan(2026, 6)
    // June 2026 first Sunday is the 7th; A is the pre-assigned owner.
    plan.days.find((d) => d.date === '2026-06-07')!.dayOffMarks = { A: 'hard', B: null }
    const out = autoPlan(plan, DEFAULT_SETTINGS)
    const jun7 = out.days.find((d) => d.date === '2026-06-07')!
    expect(jun7.shifts.some((s) => s.employeeId === 'A')).toBe(false)
    // B should now own that Sunday if no other constraint blocks it.
    expect(jun7.shifts[0]?.employeeId).toBe('B')
  })
})
