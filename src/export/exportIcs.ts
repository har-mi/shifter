import { addDays, format, parse } from 'date-fns'
import type { MonthPlan, Settings } from '@/domain/types'
import { fi } from '@/i18n/fi'
import { toMinutes } from '@/lib/time'

const CRLF = '\r\n'
const FOLD_LIMIT = 75
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Escapes text per RFC 5545 (order matters: backslash first). */
function escapeText(s: string): string {
  return s
    .replace(/\r\n|\r/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Folds a content line at 75 octets (UTF-8 bytes), continuation lines start with a space. */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(line)
  if (bytes.length <= FOLD_LIMIT) return line

  const chunks: string[] = []
  let offset = 0
  let limit = FOLD_LIMIT
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length)
    // Never split a multi-byte UTF-8 codepoint: back off while the next byte
    // is a continuation byte (10xxxxxx).
    while (end < bytes.length && (bytes[end] & 0b1100_0000) === 0b1000_0000) {
      end--
    }
    chunks.push(new TextDecoder().decode(bytes.slice(offset, end)))
    offset = end
    limit = FOLD_LIMIT - 1 // continuation lines reserve 1 octet for the leading space
  }
  return chunks.join(CRLF + ' ')
}

/** Splits a multi-line note into trimmed, non-blank lines, preserving order. */
function splitNoteLines(note: string): string[] {
  return note
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/** Formats a Date as a UTC "YYYYMMDDTHHMMSSZ" stamp. */
function formatUtcStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/**
 * True when a shift's "HH:MM" start/end are both finite and end is strictly
 * after start. Shifts are exported verbatim as text, so no midnight rollover
 * is needed — only validity matters.
 */
function isShiftTimeValid(start: string, end: string): boolean {
  const startMin = toMinutes(start)
  const endMin = toMinutes(end)
  return Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin
}

/** Appends a single-day all-day VEVENT (RFC 5545 all-day DTEND is exclusive). */
function pushAllDayEvent(
  lines: string[],
  opts: { uid: string; dtstamp: string; base: Date; summary: string },
): void {
  lines.push(
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${opts.dtstamp}`,
    `DTSTART;VALUE=DATE:${format(opts.base, 'yyyyMMdd')}`,
    `DTEND;VALUE=DATE:${format(addDays(opts.base, 1), 'yyyyMMdd')}`,
    `SUMMARY:${escapeText(opts.summary)}`,
    'SEQUENCE:0',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  )
}

/**
 * Builds an RFC 5545 iCalendar document for every shift in `monthPlan`.
 * Pure function — no DOM access — so it is fully unit-testable.
 * `now` is injectable for deterministic DTSTAMP values in tests.
 */
export function buildIcs(
  monthPlan: MonthPlan,
  settings: Settings,
  now: Date = new Date(),
): { ics: string; skipped: number } {
  const monthName = fi.months[monthPlan.month - 1]
  const dtstamp = formatUtcStamp(now)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//shifter//Tyovuorot//FI',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(`Työvuorot ${monthName} ${monthPlan.year}`)}`,
  ]

  let skipped = 0
  for (const day of monthPlan.days) {
    if (!ISO_DATE_RE.test(day.date)) {
      skipped += day.shifts.length
      continue
    }

    const base = parse(day.date, 'yyyy-MM-dd', new Date())

    // One all-day event per note line, day-level (not duplicated per employee).
    // Google sorts all-day events alphabetically with no manual reordering, so
    // "#" pins the P line to the top and shifts get "X " to sink to the bottom.
    splitNoteLines(day.note).forEach((line, index) => {
      pushAllDayEvent(lines, {
        uid: `${day.date}-note-${index}@tyovuorot.local`,
        dtstamp,
        base,
        summary: line === 'P' ? `#${line}` : line,
      })
    })

    // Per-employee occurrence index per day, so one employee's edits never
    // renumber the other employee's events.
    const perEmployeeIndex: Record<string, number> = {}
    for (const shift of day.shifts) {
      const n = perEmployeeIndex[shift.employeeId] ?? 0
      perEmployeeIndex[shift.employeeId] = n + 1

      if (!isShiftTimeValid(shift.start, shift.end)) {
        skipped++
        continue
      }

      const employee = settings.employees.find((e) => e.id === shift.employeeId)
      const name = employee?.name ?? shift.employeeId

      pushAllDayEvent(lines, {
        uid: `${day.date}-${shift.employeeId}-${n}@tyovuorot.local`,
        dtstamp,
        base,
        summary: `X ${name} ${shift.start}–${shift.end}`,
      })
    }
  }

  lines.push('END:VCALENDAR')

  const ics = lines.map(foldLine).join(CRLF) + CRLF
  return { ics, skipped }
}

/** Lazily-unnecessary but consistent name: generates the .ics and triggers a browser download. */
export function generateAndDownloadIcs(
  monthPlan: MonthPlan,
  settings: Settings,
): { skipped: number; shiftCount: number } {
  const shiftCount = monthPlan.days.reduce((sum, d) => sum + d.shifts.length, 0)
  const { ics, skipped } = buildIcs(monthPlan, settings)

  const monthName = fi.monthsGenitive[monthPlan.month - 1]
  const filename = `tyovuorot_${monthName}_${monthPlan.year}.ics`

  try {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('ICS export failed:', error)
    alert('Virhe: Kalenteriviennin epäonnistui. Katso konsoli (F12).')
  }

  return { skipped, shiftCount }
}
