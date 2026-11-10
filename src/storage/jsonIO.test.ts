import { describe, it, expect } from 'vitest'
import { MonthPlanSchema } from './jsonIO'
import type { MonthPlan } from '@/domain/types'

// Representative fixture: mixed shifts, notes, travel day, day-off marks
const fixtureMonthPlan: MonthPlan = {
  year: 2026,
  month: 6,
  days: [
    {
      date: '2026-06-01',
      shifts: [
        { employeeId: 'A', start: '13:00', end: '19:30', locked: false },
      ],
      note: 'Test note',
      pdfComment: 'PDF comment',
      isTravelDay: false,
      dayOffMarks: { A: null, B: null },
    },
    {
      date: '2026-06-02',
      shifts: [
        { employeeId: 'B', start: '06:30', end: '09:00', locked: true },
        { employeeId: 'B', start: '15:00', end: '20:30', locked: true },
      ],
      note: '',
      pdfComment: '',
      isTravelDay: true,
      dayOffMarks: { A: null, B: null },
    },
    {
      date: '2026-06-03',
      shifts: [],
      note: 'Day off',
      pdfComment: '',
      isTravelDay: false,
      dayOffMarks: { A: 'hard', B: 'soft' },
    },
    {
      date: '2026-06-04',
      shifts: [
        { employeeId: 'A', start: '13:00', end: '19:30' },
        { employeeId: 'B', start: '08:00', end: '14:30' },
      ],
      note: 'Regular shifts',
      pdfComment: 'Both working',
      isTravelDay: false,
      dayOffMarks: { A: null, B: null },
    },
  ],
}

describe('jsonIO', () => {
  it('should round-trip a MonthPlan through JSON serialization', () => {
    // Serialize as the export function would
    const json = JSON.stringify(fixtureMonthPlan)

    // Parse and validate as the import function would
    const parsed = JSON.parse(json)
    const validated = MonthPlanSchema.parse(parsed)

    // Should be deeply equal
    expect(validated).toEqual(fixtureMonthPlan)
  })

  it('should reject invalid employeeId', () => {
    const invalid = {
      year: 2026,
      month: 6,
      days: [
        {
          date: '2026-06-01',
          shifts: [
            {
              employeeId: 'C', // Invalid: only A and B allowed
              start: '13:00',
              end: '19:30',
            },
          ],
          note: '',
          pdfComment: '',
          isTravelDay: false,
          dayOffMarks: { A: null, B: null },
        },
      ],
    }

    const result = MonthPlanSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should reject out-of-range month', () => {
    const invalid = {
      year: 2026,
      month: 13, // Invalid: 1-12 only
      days: [],
    }

    const result = MonthPlanSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should reject missing required fields', () => {
    const invalid = {
      year: 2026,
      // Missing month
      days: [],
    }

    const result = MonthPlanSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should preserve all fields during round-trip including locks and day-off marks', () => {
    const plan: MonthPlan = {
      year: 2026,
      month: 12,
      days: [
        {
          date: '2026-12-24',
          shifts: [
            { employeeId: 'A', start: '06:00', end: '12:00', locked: true },
          ],
          note: 'Christmas Eve',
          pdfComment: 'Locked shift',
          isTravelDay: false,
          dayOffMarks: { A: null, B: 'hard' },
        },
      ],
    }

    const json = JSON.stringify(plan)
    const parsed = JSON.parse(json)
    const validated = MonthPlanSchema.parse(parsed)

    expect(validated.days[0].shifts[0].locked).toBe(true)
    expect(validated.days[0].dayOffMarks.B).toBe('hard')
    expect(validated.days[0].isTravelDay).toBe(false)
  })
})
