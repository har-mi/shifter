/**
 * Time helpers — all times are "HH:MM" strings in 24h format, 15-min aligned.
 * Pure functions, fully unit-testable.
 */

const QUARTER = 15

/** "HH:MM" → total minutes since 00:00. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Total minutes since 00:00 → "HH:MM" (zero-padded). */
export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** True if value is a multiple of 15 minutes. */
export function isQuarterAligned(hhmm: string): boolean {
  return toMinutes(hhmm) % QUARTER === 0
}

/** Length of a shift in hours (decimal). End must be strictly greater than start. */
export function shiftHours(start: string, end: string): number {
  return (toMinutes(end) - toMinutes(start)) / 60
}

/** Sum of all shift lengths in hours. */
export function totalHours(shifts: { start: string; end: string }[]): number {
  return shifts.reduce((acc, s) => acc + shiftHours(s.start, s.end), 0)
}

/** Snap to nearest 15-min boundary. */
export function snapToQuarter(hhmm: string): string {
  const m = toMinutes(hhmm)
  const snapped = Math.round(m / QUARTER) * QUARTER
  return fromMinutes(snapped)
}

/** Format hours as "6,5 h" (Finnish decimal comma, trim ".0"). */
export function formatHours(h: number): string {
  const rounded = Math.round(h * 100) / 100
  return rounded.toString().replace('.', ',') + ' h'
}
