import {
  addDays,
  format,
  getDay,
  isWithinInterval,
  parseISO,
} from 'date-fns'

/** Anonymous (Gauss) algorithm for Easter Sunday in the Gregorian calendar. */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** First Friday in [19.6, 25.6] of the given year. */
function midsummerEve(year: number): Date {
  for (let day = 19; day <= 25; day++) {
    const d = new Date(year, 5, day)
    if (getDay(d) === 5) return d
  }
  throw new Error('unreachable')
}

/** First Saturday in [31.10, 6.11] of the given year. */
function allSaintsDay(year: number): Date {
  for (let day = 31; day <= 31; day++) {
    const d = new Date(year, 9, day)
    if (getDay(d) === 6) return d
  }
  for (let day = 1; day <= 6; day++) {
    const d = new Date(year, 10, day)
    if (getDay(d) === 6) return d
  }
  throw new Error('unreachable')
}

/**
 * Finnish public holidays ("pyhäpäivät") used for visual tinting in the
 * calendar. The auto-planner only skips a smaller subset (see Phase 5).
 */
export function finnishHolidays(year: number): Date[] {
  const easter = easterSunday(year)
  return [
    new Date(year, 0, 1), // Uudenvuodenpäivä
    new Date(year, 0, 6), // Loppiainen
    addDays(easter, -2), // Pitkäperjantai
    easter, // Pääsiäispäivä
    addDays(easter, 1), // 2. pääsiäispäivä
    new Date(year, 4, 1), // Vappu
    addDays(easter, 39), // Helatorstai
    addDays(easter, 49), // Helluntaipäivä
    midsummerEve(year), // Juhannusaatto
    addDays(midsummerEve(year), 1), // Juhannuspäivä
    allSaintsDay(year), // Pyhäinpäivä
    new Date(year, 11, 6), // Itsenäisyyspäivä
    new Date(year, 11, 24), // Jouluaatto
    new Date(year, 11, 25), // Joulupäivä
    new Date(year, 11, 26), // Tapaninpäivä
  ]
}

/** True if `date` is a Finnish pyhäpäivä. */
export function isPublicHoliday(date: Date): boolean {
  return finnishHolidays(date.getFullYear()).some(
    (h) => format(h, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'),
  )
}

/**
 * Subset the auto-planner treats as auto days-off. Per the plan: only
 * 24.12, 25.12, Midsummer Eve, Midsummer Day.
 */
export function isPlannerHoliday(date: Date): boolean {
  const y = date.getFullYear()
  const isoDate = format(date, 'yyyy-MM-dd')
  const eve = midsummerEve(y)
  const day = addDays(eve, 1)
  const list = [
    new Date(y, 11, 24),
    new Date(y, 11, 25),
    eve,
    day,
  ]
  return list.some((h) => format(h, 'yyyy-MM-dd') === isoDate)
}

/** Convenience used by tests / planners. */
export function isPublicHolidayIso(iso: string): boolean {
  const d = parseISO(iso)
  return isPublicHoliday(d)
}

/** Holiday range helper (kept for future use). */
export function isWithinHoliday(date: Date, start: Date, end: Date): boolean {
  return isWithinInterval(date, { start, end })
}
