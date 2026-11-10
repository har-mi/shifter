import type { Settings } from '@/domain/types'

/**
 * Phase 1 defaults. These live here (not in the settings page yet) so the
 * store has a stable shape; Phase 8 will replace these knobs with editable
 * fields without changing the store schema.
 */
export const DEFAULT_SETTINGS: Settings = {
  employees: [
    { id: 'A', name: 'Name1', monthlyHours: 70 },
    { id: 'B', name: 'Name2', monthlyHours: 69 },
  ],
  preferredShifts: [
    // 11:00–18:30 (7h30) — only template allowed on Sundays.
    { weekdays: [1, 2, 3, 4, 5, 6, 7], start: '11:00', end: '18:30' },
    // 12:00–18:30 (6h30) — Mon–Sat.
    { weekdays: [1, 2, 3, 4, 5, 6], start: '12:00', end: '18:30' },
    // 13:00–19:30 (6h30) — Mon–Sat.
    { weekdays: [1, 2, 3, 4, 5, 6], start: '13:00', end: '19:30' },
  ],
  workWindow: { start: '06:30', end: '21:30' },
  minShiftMinutes: 90,
}

/** Both employees work these fixed shifts on a travel day. */
export const TRAVEL_DAY_SHIFTS = {
  early: { start: '06:30', end: '09:00' },
  late: { start: '15:00', end: '20:30' },
} as const
