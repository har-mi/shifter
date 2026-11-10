import { describe, expect, it } from 'vitest'
import {
  formatHours,
  fromMinutes,
  isQuarterAligned,
  shiftHours,
  snapToQuarter,
  toMinutes,
  totalHours,
} from './time'

describe('time helpers', () => {
  it('toMinutes / fromMinutes round-trip', () => {
    for (const t of ['00:00', '06:30', '13:00', '20:45', '21:30']) {
      expect(fromMinutes(toMinutes(t))).toBe(t)
    }
  })

  it('isQuarterAligned', () => {
    expect(isQuarterAligned('13:00')).toBe(true)
    expect(isQuarterAligned('13:15')).toBe(true)
    expect(isQuarterAligned('13:30')).toBe(true)
    expect(isQuarterAligned('13:10')).toBe(false)
    expect(isQuarterAligned('13:07')).toBe(false)
  })

  it('shiftHours computes decimal length', () => {
    expect(shiftHours('13:00', '19:30')).toBe(6.5)
    expect(shiftHours('06:30', '09:00')).toBe(2.5)
  })

  it('totalHours sums shifts', () => {
    expect(
      totalHours([
        { start: '13:00', end: '19:30' },
        { start: '06:30', end: '09:00' },
      ]),
    ).toBe(9)
  })

  it('snapToQuarter snaps to nearest 15 min', () => {
    expect(snapToQuarter('13:07')).toBe('13:00')
    expect(snapToQuarter('13:08')).toBe('13:15')
    expect(snapToQuarter('13:22')).toBe('13:15')
    expect(snapToQuarter('13:23')).toBe('13:30')
  })

  it('formatHours uses Finnish decimal comma', () => {
    expect(formatHours(6.5)).toBe('6,5 h')
    expect(formatHours(7)).toBe('7 h')
    expect(formatHours(0.25)).toBe('0,25 h')
  })
})
