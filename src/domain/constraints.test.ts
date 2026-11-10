import { describe, expect, it } from 'vitest'
import { validate } from './constraints'
import { emptyMonthPlan } from './monthPlan'
import { DEFAULT_SETTINGS } from '@/config/defaults'
import type { DayPlan, MonthPlan, Shift } from './types'

function planWith(year: number, month: number, mutate: (days: DayPlan[]) => void): MonthPlan {
  const p = emptyMonthPlan(year, month)
  mutate(p.days)
  return p
}

const shift = (employeeId: 'A' | 'B', start: string, end: string): Shift => ({
  employeeId,
  start,
  end,
})

describe('validate', () => {
  it('empty month is only flagged as hours_under for both employees', () => {
    const p = emptyMonthPlan(2026, 6)
    const v = validate(p, DEFAULT_SETTINGS)
    expect(v.filter((x) => x.code === 'hours_under')).toHaveLength(2)
    expect(v.filter((x) => x.code !== 'hours_under')).toHaveLength(0)
  })

  it('exact hour totals produce no hour violations (disjoint days per employee)', () => {
    const p = planWith(2026, 6, (days) => {
      // 10 × 7h = 70 for A on days 0..9
      for (let i = 0; i < 10; i++) days[i].shifts.push(shift('A', '13:00', '20:00'))
      // 9 × 7h + 1 × 6h = 69 for B on disjoint days 10..19
      for (let i = 10; i < 19; i++) days[i].shifts.push(shift('B', '13:00', '20:00'))
      days[19].shifts.push(shift('B', '13:00', '19:00'))
    })
    const v = validate(p, DEFAULT_SETTINGS)
    expect(v.find((x) => x.code === 'hours_under' || x.code === 'hours_over')).toBeUndefined()
    expect(v.find((x) => x.code === 'cross_employee_same_day')).toBeUndefined()
  })

  it('flags shift_too_short for <90 min and end<=start', () => {
    const p = planWith(2026, 6, (days) => {
      days[0].shifts.push(shift('A', '13:00', '14:00')) // 60 min
      days[1].shifts.push(shift('A', '13:00', '13:00')) // 0 min
      days[2].shifts.push(shift('A', '13:00', '12:00')) // negative
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'shift_too_short')
    expect(v).toHaveLength(3)
  })

  it('flags shift_not_aligned for non-15-min times', () => {
    const p = planWith(2026, 6, (days) => {
      days[0].shifts.push(shift('A', '13:07', '19:30'))
      days[1].shifts.push(shift('A', '13:00', '19:25'))
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'shift_not_aligned')
    expect(v).toHaveLength(2)
  })

  it('flags overlapping shifts once per day regardless of employee', () => {
    const p = planWith(2026, 6, (days) => {
      days[0].shifts.push(shift('A', '13:00', '17:00'))
      days[0].shifts.push(shift('A', '16:00', '20:00')) // overlaps first
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'overlapping_shifts')
    expect(v).toHaveLength(1)
  })

  it('flags cross_employee_same_day on non-travel days', () => {
    const p = planWith(2026, 6, (days) => {
      // Pre-shift "early" then "late" — non-overlapping, but two employees same day.
      days[0].shifts.push(shift('A', '06:30', '09:00'))
      days[0].shifts.push(shift('B', '15:00', '20:30'))
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'cross_employee_same_day')
    expect(v).toHaveLength(1)
    expect(v[0].date).toBe(p.days[0].date)
  })

  it('does NOT flag cross_employee_same_day on travel days', () => {
    const p = planWith(2026, 6, (days) => {
      days[0].isTravelDay = true
      days[0].shifts.push(shift('A', '06:30', '09:00'))
      days[0].shifts.push(shift('B', '15:00', '20:30'))
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'cross_employee_same_day')
    expect(v).toHaveLength(0)
  })

  it('flags 5 consecutive workdays', () => {
    const p = planWith(2026, 6, (days) => {
      for (let i = 0; i < 5; i++) days[i].shifts.push(shift('A', '13:00', '19:30'))
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'rest_rule_broken')
    expect(v).toHaveLength(1)
    expect(v[0].date).toBe(p.days[4].date)
  })

  it('flags work after 4 work + only 1 rest', () => {
    const p = planWith(2026, 6, (days) => {
      for (let i = 0; i < 4; i++) days[i].shifts.push(shift('A', '13:00', '19:30'))
      // day 5 rest
      days[5].shifts.push(shift('A', '13:00', '19:30')) // day 6, only 1 rest after 4
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'rest_rule_broken')
    expect(v).toHaveLength(1)
    expect(v[0].date).toBe(p.days[5].date)
  })

  it('accepts 4 work + 2 rest cleanly', () => {
    const p = planWith(2026, 6, (days) => {
      for (let i = 0; i < 4; i++) days[i].shifts.push(shift('A', '13:00', '19:30'))
      // days 4,5 rest
      days[6].shifts.push(shift('A', '13:00', '19:30')) // day 7 ok
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'rest_rule_broken')
    expect(v).toHaveLength(0)
  })

  it('flags alternation_run_too_long when one employee has >4 shifts before the other works', () => {
    // 5 B shifts with rest days interleaved, then A. The rest days reset the
    // per-employee rest-rule streak (so no rest violation), but the
    // alternation rule should still catch the run.
    const p = planWith(2026, 6, (days) => {
      days[0].shifts.push(shift('B', '13:00', '19:30'))
      days[1].shifts.push(shift('B', '13:00', '19:30'))
      days[2].shifts.push(shift('B', '13:00', '19:30'))
      // days[3], days[4] rest (resets rest-rule streak)
      days[5].shifts.push(shift('B', '13:00', '19:30'))
      days[6].shifts.push(shift('B', '13:00', '19:30')) // 5th B in a row
      days[7].shifts.push(shift('A', '13:00', '19:30'))
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'alternation_run_too_long')
    expect(v).toHaveLength(1)
    expect(v[0].date).toBe(p.days[6].date)
    expect(v[0].employeeId).toBe('B')
  })

  it('does not flag alternation when the run is exactly 4', () => {
    const p = planWith(2026, 6, (days) => {
      for (let i = 0; i < 4; i++) days[i].shifts.push(shift('B', '13:00', '19:30'))
      days[4].shifts.push(shift('A', '13:00', '19:30'))
      for (let i = 5; i < 9; i++) days[i].shifts.push(shift('B', '13:00', '19:30'))
    })
    const v = validate(p, DEFAULT_SETTINGS).filter((x) => x.code === 'alternation_run_too_long')
    expect(v).toHaveLength(0)
  })

  it('flags travel_day_shift_missing when a travel day lacks the required shifts', () => {
    const p = planWith(2026, 6, (days) => {
      days[5].isTravelDay = true
      // Only A's late shift present; B's early is missing.
      days[5].shifts.push({ employeeId: 'A', start: '15:00', end: '20:30', locked: true })
    })
    const v = validate(p, DEFAULT_SETTINGS).filter(
      (x) => x.code === 'travel_day_shift_missing',
    )
    // B missing early = 1 violation.
    expect(v).toHaveLength(1)
    expect(v[0].employeeId).toBe('B')
  })

  it('accepts a fully-formed travel day (B early, A late) with no integrity violations', () => {
    const p = planWith(2026, 6, (days) => {
      days[5].isTravelDay = true
      days[5].shifts.push({ employeeId: 'B', start: '06:30', end: '09:00', locked: true })
      days[5].shifts.push({ employeeId: 'A', start: '15:00', end: '20:30', locked: true })
    })
    const v = validate(p, DEFAULT_SETTINGS).filter(
      (x) => x.code === 'travel_day_shift_missing',
    )
    expect(v).toHaveLength(0)
  })

  it('flags hard_day_off_violated when a shift is set on a hard day-off', () => {
    const p = planWith(2026, 6, (days) => {
      days[10].dayOffMarks = { A: 'hard', B: null }
      days[10].shifts.push(shift('A', '13:00', '19:30'))
    })
    const v = validate(p, DEFAULT_SETTINGS).filter(
      (x) => x.code === 'hard_day_off_violated',
    )
    expect(v).toHaveLength(1)
    expect(v[0].employeeId).toBe('A')
    expect(v[0].date).toBe(p.days[10].date)
  })

  it('does not flag soft day-off when a shift is set', () => {
    const p = planWith(2026, 6, (days) => {
      days[10].dayOffMarks = { A: 'soft', B: null }
      days[10].shifts.push(shift('A', '13:00', '19:30'))
    })
    const v = validate(p, DEFAULT_SETTINGS).filter(
      (x) => x.code === 'hard_day_off_violated',
    )
    expect(v).toHaveLength(0)
  })
})
