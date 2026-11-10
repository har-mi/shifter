import { describe, expect, it } from 'vitest'
import { buildIcs } from '@/export/exportIcs'
import { emptyMonthPlan } from '@/domain/monthPlan'
import { DEFAULT_SETTINGS } from '@/config/defaults'
import type { DayPlan, MonthPlan, Shift } from '@/domain/types'

function planWithDay(
  year: number,
  month: number,
  date: string,
  shifts: Shift[],
  overrides: Partial<DayPlan> = {},
): MonthPlan {
  const plan = emptyMonthPlan(year, month)
  const day = plan.days.find((d) => d.date === date)
  if (!day) throw new Error(`no day ${date} in ${year}-${month}`)
  Object.assign(day, { shifts, ...overrides })
  return plan
}

function eventBlocks(ics: string): string[] {
  return ics.split('BEGIN:VEVENT').slice(1)
}

const NOW = new Date(Date.UTC(2026, 6, 1, 12, 0, 0))

describe('buildIcs', () => {
  it('emits no VEVENT for an empty month', () => {
    const plan = emptyMonthPlan(2026, 8)
    const { ics, skipped } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(eventBlocks(ics)).toHaveLength(0)
    expect(skipped).toBe(0)
  })

  it('builds the calendar envelope without METHOD or a VTIMEZONE', () => {
    const plan = emptyMonthPlan(2026, 8)
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).not.toContain('VTIMEZONE')
    expect(ics).not.toContain('TZID')
    expect(ics).not.toMatch(/^METHOD:/m)
  })

  it('uses CRLF line endings throughout', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [
      { employeeId: 'A', start: '11:00', end: '18:30' },
    ])
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(ics).not.toMatch(/[^\r]\n/)
    expect(ics.split('\r\n').length).toBeGreaterThan(1)
  })

  it('produces a deterministic UTC DTSTAMP from the injected now', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [
      { employeeId: 'A', start: '11:00', end: '18:30' },
    ])
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(ics).toContain('DTSTAMP:20260701T120000Z')
  })

  it('gives a shift event an exclusive one-day all-day DTSTART/DTEND', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [
      { employeeId: 'A', start: '11:00', end: '18:30' },
    ])
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260815')
    expect(ics).toContain('DTEND;VALUE=DATE:20260816')
  })

  it('renders a 24:00 end time verbatim in the title instead of rolling to the next day', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [
      { employeeId: 'A', start: '20:00', end: '24:00' },
    ])
    const { ics, skipped } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(skipped).toBe(0)
    expect(eventBlocks(ics)).toHaveLength(1)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260815')
    expect(ics).toContain('DTEND;VALUE=DATE:20260816')
    expect(ics).toContain(`SUMMARY:X ${DEFAULT_SETTINGS.employees[0].name} 20:00–24:00`)
  })

  it('skips a shift where end <= start and reports the count', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [
      { employeeId: 'A', start: '18:00', end: '18:00' },
      { employeeId: 'A', start: '19:00', end: '17:00' },
      { employeeId: 'B', start: '11:00', end: '18:30' },
    ])
    const { ics, skipped } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(skipped).toBe(2)
    expect(eventBlocks(ics)).toHaveLength(1)
  })

  it('skips a shift with a malformed day date', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [
      { employeeId: 'A', start: '11:00', end: '18:30' },
    ])
    plan.days.find((d) => d.date === '2026-08-15')!.date = 'not-a-date'
    const { ics, skipped } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(skipped).toBe(1)
    expect(eventBlocks(ics)).toHaveLength(0)
  })

  it('assigns per-employee UID occurrence indices independently', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [
      { employeeId: 'A', start: '06:30', end: '09:00' },
      { employeeId: 'B', start: '10:00', end: '12:00' },
      { employeeId: 'A', start: '15:00', end: '20:30' },
      { employeeId: 'B', start: '13:00', end: '14:00' },
    ])
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(ics).toContain('UID:2026-08-15-A-0@tyovuorot.local')
    expect(ics).toContain('UID:2026-08-15-A-1@tyovuorot.local')
    expect(ics).toContain('UID:2026-08-15-B-0@tyovuorot.local')
    expect(ics).toContain('UID:2026-08-15-B-1@tyovuorot.local')
  })

  it('resolves SUMMARY to "X <employee name> <start>–<end>"', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [
      { employeeId: 'A', start: '11:00', end: '18:30' },
    ])
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(ics).toContain(
      `SUMMARY:X ${DEFAULT_SETTINGS.employees[0].name} 11:00–18:30`,
    )
  })

  it('falls back to the raw employeeId when the employee is missing from settings', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [
      { employeeId: 'A', start: '11:00', end: '18:30' },
    ])
    // Simulate a genuinely missing employee "A" by duplicating "B" into both slots.
    const noEmployeeA = {
      ...DEFAULT_SETTINGS,
      employees: [
        DEFAULT_SETTINGS.employees[1],
        DEFAULT_SETTINGS.employees[1],
      ] as typeof DEFAULT_SETTINGS.employees,
    }
    const { ics } = buildIcs(plan, noEmployeeA, NOW)
    expect(ics).toContain('SUMMARY:X A 11:00–18:30')
  })

  it('shift events have no DESCRIPTION, and pdfComment has no effect on the output', () => {
    const withComment = planWithDay(
      2026,
      8,
      '2026-08-15',
      [{ employeeId: 'A', start: '11:00', end: '18:30' }],
      { pdfComment: 'Tuo avaimet' },
    )
    const withoutComment = planWithDay(
      2026,
      8,
      '2026-08-15',
      [{ employeeId: 'A', start: '11:00', end: '18:30' }],
      { pdfComment: '' },
    )
    const { ics: icsWithComment } = buildIcs(withComment, DEFAULT_SETTINGS, NOW)
    const { ics: icsWithoutComment } = buildIcs(withoutComment, DEFAULT_SETTINGS, NOW)
    expect(icsWithComment).not.toContain('DESCRIPTION')
    expect(icsWithComment).not.toContain('Tuo avaimet')
    expect(icsWithComment).toBe(icsWithoutComment)
  })

  it('emits one all-day event per non-blank note line, prefixing an exact "P" line with "#"', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [], {
      note: 'P\nM ESPOO 7-19\nD: M vie, S hakee\nFT 10',
    })
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    const blocks = eventBlocks(ics)
    expect(blocks).toHaveLength(4)
    expect(blocks[0]).toContain('SUMMARY:#P')
    expect(blocks[1]).toContain('SUMMARY:M ESPOO 7-19')
    expect(blocks[2]).toContain('SUMMARY:D: M vie\\, S hakee')
    expect(blocks[3]).toContain('SUMMARY:FT 10')
  })

  it('does not prefix a note line that is merely similar to "P"', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [], {
      note: 'PP\nP2\n  P  ',
    })
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    const blocks = eventBlocks(ics)
    expect(blocks[0]).toContain('SUMMARY:PP')
    expect(blocks[1]).toContain('SUMMARY:P2')
    // Trimmed to exactly "P", so this one IS prefixed.
    expect(blocks[2]).toContain('SUMMARY:#P')
  })

  it('prefixes "P" with "#" and every shift with "X ", so Google\'s alphabetical sort pins P first and shifts last', () => {
    const plan = planWithDay(
      2026,
      8,
      '2026-08-15',
      [{ employeeId: 'A', start: '11:00', end: '18:30' }],
      { note: 'P\nsome entry\nsome entry2' },
    )
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    const summaries = eventBlocks(ics).map(
      (block) => /SUMMARY:(.*)/.exec(block)?.[1]?.trim(),
    )
    expect(summaries).toEqual([
      '#P',
      'some entry',
      'some entry2',
      `X ${DEFAULT_SETTINGS.employees[0].name} 11:00\u201318:30`,
    ])
  })

  it('skips blank lines within a multi-line note', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [], {
      note: 'P\n\n   \nM ESPOO 7-19',
    })
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(eventBlocks(ics)).toHaveLength(2)
  })

  it('produces no note events when the note is empty or whitespace-only', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [], { note: '   ' })
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(eventBlocks(ics)).toHaveLength(0)
  })

  it('gives note events an exclusive one-day all-day DTSTART/DTEND and a distinct UID', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [], { note: 'P' })
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260815')
    expect(ics).toContain('DTEND;VALUE=DATE:20260816')
    expect(ics).toContain('UID:2026-08-15-note-0@tyovuorot.local')
  })

  it('marks both note events and shift events TRANSPARENT (never OPAQUE)', () => {
    const plan = planWithDay(
      2026,
      8,
      '2026-08-15',
      [{ employeeId: 'A', start: '11:00', end: '18:30' }],
      { note: 'P' },
    )
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    const blocks = eventBlocks(ics)
    expect(blocks[0]).toContain('TRANSP:TRANSPARENT')
    expect(blocks[1]).toContain('TRANSP:TRANSPARENT')
    expect(ics).not.toContain('OPAQUE')
  })

  it('emits note events for a day with no shifts at all', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [], { note: 'P\nQ' })
    const { ics, skipped } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(eventBlocks(ics)).toHaveLength(2)
    expect(skipped).toBe(0)
  })

  it('escapes special characters in a note line SUMMARY', () => {
    const plan = planWithDay(2026, 8, '2026-08-15', [], {
      note: 'Muista, tuo avaimet; ja \\ ovi',
    })
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    expect(ics).toContain('SUMMARY:Muista\\, tuo avaimet\\; ja \\\\ ovi')
  })

  it('folds a long multi-byte note line SUMMARY within 75 octets per line, without corrupting characters', () => {
    const longLine = 'ä'.repeat(60) + 'ö'.repeat(60)
    const plan = planWithDay(2026, 8, '2026-08-15', [], { note: longLine })
    const { ics } = buildIcs(plan, DEFAULT_SETTINGS, NOW)
    const encoder = new TextEncoder()
    const physicalLines = ics.split('\r\n')
    for (const line of physicalLines) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
    // Unfold (strip CRLF + leading space on continuation lines) and check the
    // full escaped line survives intact.
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain(`SUMMARY:${longLine}`)
  })
})
