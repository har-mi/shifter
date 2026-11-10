export type EmployeeId = 'A' | 'B'

export interface Employee {
  id: EmployeeId
  name: string
  monthlyHours: number
}

/** 15-minute aligned shift, both endpoints inclusive of the window 06:30–21:30. */
export interface Shift {
  employeeId: EmployeeId
  /** "HH:MM" — 15-minute aligned. */
  start: string
  /** "HH:MM" — 15-minute aligned, strictly greater than `start`. */
  end: string
  /** Locked shifts (e.g. travel-day pre-fills) cannot be modified by the planner. */
  locked?: boolean
}

export type DayOffMark = 'soft' | 'hard' | null

export interface DayPlan {
  /** ISO date "YYYY-MM-DD". */
  date: string
  shifts: Shift[]
  /** Fridge-door style note shown on the calendar cell. */
  note: string
  /** Per-day comment that appears on the employee PDF row. */
  pdfComment: string
  /** Travel day: both employees work the fixed pre-set shifts. */
  isTravelDay: boolean
  /** Day-off preference per employee (none / soft / hard). */
  dayOffMarks: Record<EmployeeId, DayOffMark>
}

export interface MonthPlan {
  /** Four-digit year, e.g. 2026. */
  year: number
  /** 1-12 (NOT 0-11 like JS Date). */
  month: number
  days: DayPlan[]
}

export interface PreferredShift {
  /** Weekday 1-7 (Mon=1 … Sun=7). */
  weekdays: number[]
  start: string
  end: string
}

export interface Settings {
  employees: [Employee, Employee]
  /** Default preferred shift list the planner draws from. */
  preferredShifts: PreferredShift[]
  /** Allowed work window. */
  workWindow: { start: string; end: string }
  /** Minimum shift length in minutes. */
  minShiftMinutes: number
}

export type View = 'calendar' | 'settings'

export interface Violation {
  date?: string
  employeeId?: EmployeeId
  /** Stable code, used for grouping & translations. */
  code:
    | 'hours_under'
    | 'hours_over'
    | 'shift_out_of_window'
    | 'shift_too_short'
    | 'shift_not_aligned'
    | 'rest_rule_broken'
    | 'overlapping_shifts'
    | 'cross_employee_same_day'
    | 'alternation_run_too_long'
    | 'hard_day_off_violated'
    | 'travel_day_shift_missing'
  /** Human-readable message in Finnish, ready to render. */
  message: string
}
