import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import { finnishHolidays, isPlannerHoliday, isPublicHoliday } from './holidays'

const isoLocal = (d: Date) => format(d, 'yyyy-MM-dd')

describe('finnish holidays', () => {
  it('includes fixed holidays', () => {
    const h = finnishHolidays(2026).map(isoLocal)
    expect(h).toContain('2026-01-01')
    expect(h).toContain('2026-01-06')
    expect(h).toContain('2026-05-01')
    expect(h).toContain('2026-12-06')
    expect(h).toContain('2026-12-24')
    expect(h).toContain('2026-12-25')
    expect(h).toContain('2026-12-26')
  })

  it('computes Easter-derived holidays for 2026', () => {
    // Easter 2026 = 5 April; Good Friday 3.4, Easter Mon 6.4.
    const h = finnishHolidays(2026).map(isoLocal)
    expect(h).toContain('2026-04-03')
    expect(h).toContain('2026-04-05')
    expect(h).toContain('2026-04-06')
  })

  it('computes Midsummer for 2026', () => {
    // Friday between 19–25 June 2026 → 19.6.2026.
    const h = finnishHolidays(2026).map(isoLocal)
    expect(h).toContain('2026-06-19')
    expect(h).toContain('2026-06-20')
  })

  it('isPublicHoliday for Christmas', () => {
    expect(isPublicHoliday(new Date(2026, 11, 24))).toBe(true)
    expect(isPublicHoliday(new Date(2026, 11, 25))).toBe(true)
    expect(isPublicHoliday(new Date(2026, 11, 23))).toBe(false)
  })

  it('isPlannerHoliday is the smaller subset', () => {
    expect(isPlannerHoliday(new Date(2026, 11, 24))).toBe(true)
    expect(isPlannerHoliday(new Date(2026, 11, 25))).toBe(true)
    expect(isPlannerHoliday(new Date(2026, 11, 26))).toBe(false) // Tapaninpäivä not auto-skipped
    expect(isPlannerHoliday(new Date(2026, 0, 1))).toBe(false) // Uudenvuosi not auto-skipped
  })
})
