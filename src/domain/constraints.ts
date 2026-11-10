import type {
  EmployeeId,
  MonthPlan,
  Settings,
  Shift,
  Violation,
} from './types'
import { isQuarterAligned, toMinutes, totalHours } from '@/lib/time'
import { TRAVEL_DAY_SHIFTS } from '@/config/defaults'

/**
 * Pure validator. Manual edits intentionally accept any time-of-day (the
 * 06:30–21:30 work window only constrains the auto-planner). All checks
 * here are rules the user actually wants flagged in the violations panel.
 */
export function validate(plan: MonthPlan, settings: Settings): Violation[] {
  const violations: Violation[] = []
  const employees = settings.employees

  // --- Per-shift integrity ------------------------------------------------
  for (const day of plan.days) {
    for (const s of day.shifts) {
      if (!isQuarterAligned(s.start) || !isQuarterAligned(s.end)) {
        violations.push({
          date: day.date,
          employeeId: s.employeeId,
          code: 'shift_not_aligned',
          message: `Vuoro ei ole 15 minuutin tarkkuudella (${s.start}–${s.end}).`,
        })
      }
      const len = toMinutes(s.end) - toMinutes(s.start)
      if (len < settings.minShiftMinutes) {
        const minH = settings.minShiftMinutes / 60
        violations.push({
          date: day.date,
          employeeId: s.employeeId,
          code: 'shift_too_short',
          message:
            len <= 0
              ? `Vuoron loppuajan tulee olla alkuajan jälkeen (${s.start}–${s.end}).`
              : `Vuoro on alle ${formatMinH(minH)} (${s.start}–${s.end}).`,
        })
      }
    }
  }

  // --- Overlapping shifts (per day, any employee) -------------------------
  for (const day of plan.days) {
    const sorted = day.shifts
      .slice()
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    for (let i = 1; i < sorted.length; i++) {
      if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
        violations.push({
          date: day.date,
          code: 'overlapping_shifts',
          message: 'Päivän vuorot menevät päällekkäin.',
        })
        break // one per day is enough
      }
    }
  }

  // --- One employee per day (travel days excepted) ------------------------
  for (const day of plan.days) {
    if (day.isTravelDay) continue
    const hasA = day.shifts.some((s) => s.employeeId === 'A')
    const hasB = day.shifts.some((s) => s.employeeId === 'B')
    if (hasA && hasB) {
      violations.push({
        date: day.date,
        code: 'cross_employee_same_day',
        message:
          'Vain yksi työntekijä saa työskennellä samana päivänä (paitsi reissupäivinä).',
      })
    }
  }

  // --- Travel-day integrity ----------------------------------------------
  // A travel day must contain: B gets 06:30–09:00 (early), A gets 15:00–20:30 (late).
  // One shift per employee, no overlap.
  for (const day of plan.days) {
    if (!day.isTravelDay) continue
    const bEarly = day.shifts.some(
      (s) =>
        s.employeeId === 'B' &&
        s.start === TRAVEL_DAY_SHIFTS.early.start &&
        s.end === TRAVEL_DAY_SHIFTS.early.end,
    )
    const aLate = day.shifts.some(
      (s) =>
        s.employeeId === 'A' &&
        s.start === TRAVEL_DAY_SHIFTS.late.start &&
        s.end === TRAVEL_DAY_SHIFTS.late.end,
    )
    if (!bEarly) {
      violations.push({
        date: day.date,
        employeeId: 'B',
        code: 'travel_day_shift_missing',
        message: `${employees.find((e) => e.id === 'B')?.name ?? 'B'}: reissupäivän aamuvuoro puuttuu (06:30–09:00).`,
      })
    }
    if (!aLate) {
      violations.push({
        date: day.date,
        employeeId: 'A',
        code: 'travel_day_shift_missing',
        message: `${employees.find((e) => e.id === 'A')?.name ?? 'A'}: reissupäivän illallisen vuoro puuttuu (15:00–20:30).`,
      })
    }
  }

  // --- Hard day-off honoured ---------------------------------------------
  for (const day of plan.days) {
    for (const emp of employees) {
      if (day.dayOffMarks[emp.id] !== 'hard') continue
      if (day.shifts.some((s) => s.employeeId === emp.id)) {
        violations.push({
          date: day.date,
          employeeId: emp.id,
          code: 'hard_day_off_violated',
          message: `${emp.name}: pakollinen vapaapäivä — vuoro merkitty silti.`,
        })
      }
    }
  }

  // --- 4-then-2 consecutive-rest rule (per employee) ----------------------
  for (const emp of employees) {
    let streak = 0
    let pendingRest = 0
    for (const day of plan.days) {
      const isWork = day.shifts.some((s) => s.employeeId === emp.id)
      if (isWork) {
        if (pendingRest > 0) {
          violations.push({
            date: day.date,
            employeeId: emp.id,
            code: 'rest_rule_broken',
            message: `${emp.name}: 4 työpäivän jälkeen tarvitaan 2 vapaapäivää peräkkäin.`,
          })
          pendingRest = 0
          streak = 1
        } else {
          streak += 1
          if (streak === 5) {
            violations.push({
              date: day.date,
              employeeId: emp.id,
              code: 'rest_rule_broken',
              message: `${emp.name}: enintään 4 työpäivää peräkkäin.`,
            })
            // reset so we don't flag every subsequent day in the run
            streak = 1
            pendingRest = 0
          } else if (streak === 4) {
            pendingRest = 2
          }
        }
      } else {
        if (pendingRest > 0) pendingRest -= 1
        streak = 0
      }
    }
  }

  // --- Alternation rule: at most 4 same-employee shifts in a row --------
  // "In a row" means consecutive shift-days, ignoring rest days. Once the
  // other employee works, the run resets.
  {
    const sequence: { date: string; empId: EmployeeId; name: string }[] = []
    const nameById = new Map<EmployeeId, string>(employees.map((e) => [e.id, e.name]))
    for (const day of plan.days) {
      for (const s of day.shifts) {
        sequence.push({
          date: day.date,
          empId: s.employeeId,
          name: nameById.get(s.employeeId) ?? s.employeeId,
        })
      }
    }
    let runEmp: EmployeeId | null = null
    let runLen = 0
    for (const entry of sequence) {
      if (entry.empId === runEmp) {
        runLen += 1
        if (runLen === 5) {
          violations.push({
            date: entry.date,
            employeeId: entry.empId,
            code: 'alternation_run_too_long',
            message: `${entry.name}: yli 4 työvuoroa peräkkäin ilman toisen työntekijän välivuoroa.`,
          })
        }
      } else {
        runEmp = entry.empId
        runLen = 1
      }
    }
  }

  // --- Hour totals --------------------------------------------------------
  for (const emp of employees) {
    const own: Shift[] = plan.days.flatMap((d) =>
      d.shifts.filter((s) => s.employeeId === emp.id),
    )
    const hours = totalHours(own)
    if (hours < emp.monthlyHours) {
      violations.push({
        employeeId: emp.id,
        code: 'hours_under',
        message: `${emp.name}: ${formatH(hours)} / ${emp.monthlyHours} h — alle tavoitteen (puuttuu ${formatH(emp.monthlyHours - hours)}).`,
      })
    } else if (hours > emp.monthlyHours) {
      violations.push({
        employeeId: emp.id,
        code: 'hours_over',
        message: `${emp.name}: ${formatH(hours)} / ${emp.monthlyHours} h — yli tavoitteen (${formatH(hours - emp.monthlyHours)} liikaa).`,
      })
    }
  }

  return violations
}

/** Group violations by employee id; useful for the header badge. */
export function countByEmployee(
  violations: Violation[],
): Record<EmployeeId | 'none', number> {
  const out: Record<string, number> = { A: 0, B: 0, none: 0 }
  for (const v of violations) {
    out[v.employeeId ?? 'none'] += 1
  }
  return out as Record<EmployeeId | 'none', number>
}

function formatH(h: number): string {
  const r = Math.round(h * 100) / 100
  return r.toString().replace('.', ',')
}

function formatMinH(h: number): string {
  return `${formatH(h)} h`
}
