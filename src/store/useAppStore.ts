import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS, TRAVEL_DAY_SHIFTS } from '@/config/defaults'
import { emptyMonthPlan } from '@/domain/monthPlan'
import type { DayOffMark, DayPlan, EmployeeId, MonthPlan, Settings, Shift } from '@/domain/types'

/** "YYYY-MM" key for the `plans` map. */
export const monthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`

function isTravelShift(s: Shift): boolean {
  return (
    (s.start === TRAVEL_DAY_SHIFTS.early.start && s.end === TRAVEL_DAY_SHIFTS.early.end) ||
    (s.start === TRAVEL_DAY_SHIFTS.late.start && s.end === TRAVEL_DAY_SHIFTS.late.end)
  )
}

interface AppState {
  /** Active month coordinates. */
  currentYear: number
  currentMonth: number
  /** Cached plans for every visited month; survives navigation. */
  plans: Record<string, MonthPlan>
  /** Derived convenience: the plan for the active month. */
  monthPlan: MonthPlan
  settings: Settings
  /** ISO date of the day currently open in the DayEditor drawer, or null. */
  editingDate: string | null

  // ---- actions ----
  goToMonth: (year: number, month: number) => void
  setEditingDate: (date: string | null) => void
  updateDay: (date: string, patch: Partial<Omit<DayPlan, 'date'>>) => void
  setTravelDay: (date: string, on: boolean) => void
  setDayOffMark: (date: string, employeeId: EmployeeId, mark: DayOffMark) => void
  replaceMonthPlan: (plan: MonthPlan) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetSettings: () => void
}

const today = new Date()
const initialYear = today.getFullYear()
const initialMonth = today.getMonth() + 1
const initialKey = monthKey(initialYear, initialMonth)
const initialPlan = emptyMonthPlan(initialYear, initialMonth)

export const STORAGE_KEY = 'shifter-state'
const LEGACY_STORAGE_KEY = 'scheduler-state'

// One-time move of data saved under the pre-rename key.
if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === null) {
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacy !== null) {
    localStorage.setItem(STORAGE_KEY, legacy)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentYear: initialYear,
      currentMonth: initialMonth,
      plans: { [initialKey]: initialPlan },
      monthPlan: initialPlan,
      settings: DEFAULT_SETTINGS,
      editingDate: null,

      goToMonth: (year, month) => {
        set((state) => {
          if (state.currentYear === year && state.currentMonth === month) {
            return state
          }
          const key = monthKey(year, month)
          const plan = state.plans[key] ?? emptyMonthPlan(year, month)
          return {
            currentYear: year,
            currentMonth: month,
            plans: { ...state.plans, [key]: plan },
            monthPlan: plan,
            editingDate: null,
          }
        })
      },

      setEditingDate: (date) => set({ editingDate: date }),

      updateDay: (date, patch) => {
        set((state) => {
          const key = monthKey(state.currentYear, state.currentMonth)
          const updated: MonthPlan = {
            ...state.monthPlan,
            days: state.monthPlan.days.map((d) =>
              d.date === date ? { ...d, ...patch } : d,
            ),
          }
          return {
            plans: { ...state.plans, [key]: updated },
            monthPlan: updated,
          }
        })
      },

      setTravelDay: (date, on) => {
        set((state) => {
          const key = monthKey(state.currentYear, state.currentMonth)
          const updated: MonthPlan = {
            ...state.monthPlan,
            days: state.monthPlan.days.map((d) => {
              if (d.date !== date) return d
              if (on) {
                // B: 06:30–09:00, A: 15:00–20:30 (one shift each, no overlap).
                const travelShifts: Shift[] = [
                  { employeeId: 'B', ...TRAVEL_DAY_SHIFTS.early, locked: true },
                  { employeeId: 'A', ...TRAVEL_DAY_SHIFTS.late, locked: true },
                ]
                return { ...d, isTravelDay: true, shifts: travelShifts }
              }
              // Toggling off: drop only the travel-style locked shifts.
              const remaining = d.shifts.filter(
                (s) => !(s.locked && isTravelShift(s)),
              )
              return { ...d, isTravelDay: false, shifts: remaining }
            }),
          }
          return {
            plans: { ...state.plans, [key]: updated },
            monthPlan: updated,
          }
        })
      },

      setDayOffMark: (date, employeeId, mark) => {
        set((state) => {
          const key = monthKey(state.currentYear, state.currentMonth)
          const updated: MonthPlan = {
            ...state.monthPlan,
            days: state.monthPlan.days.map((d) =>
              d.date === date
                ? { ...d, dayOffMarks: { ...d.dayOffMarks, [employeeId]: mark } }
                : d,
            ),
          }
          return {
            plans: { ...state.plans, [key]: updated },
            monthPlan: updated,
          }
        })
      },

      replaceMonthPlan: (plan) => {
        set((state) => {
          const key = monthKey(plan.year, plan.month)
          return {
            plans: { ...state.plans, [key]: plan },
            // If replacing the currently-viewed month, mirror it to monthPlan.
            monthPlan:
              key === monthKey(state.currentYear, state.currentMonth)
                ? plan
                : state.monthPlan,
          }
        })
      },

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persistedState, version) => {
        const s = persistedState as Record<string, unknown>
        // v1 → v2: migrate single monthPlan to multi-month plans cache.
        if (version < 2 && s && 'monthPlan' in s && !('plans' in s)) {
          const old = s.monthPlan as MonthPlan
          const key = monthKey(old.year, old.month)
          return {
            ...s,
            currentYear: old.year,
            currentMonth: old.month,
            plans: { [key]: old },
            monthPlan: old,
          } as unknown as AppState
        }
        // v2 → v3: drop view field (Settings page removed).
        if (version < 3 && s) {
          delete s.view
        }
        return persistedState as AppState
      },
      partialize: (state) =>
        ({
          plans: state.plans,
          currentYear: state.currentYear,
          currentMonth: state.currentMonth,
          settings: state.settings,
        }) as Partial<AppState>,
      onRehydrateStorage: () => (state) => {
        // After rehydrate, make sure monthPlan mirrors the active key.
        if (!state) return
        const key = monthKey(state.currentYear, state.currentMonth)
        const plan = state.plans[key] ?? emptyMonthPlan(state.currentYear, state.currentMonth)
        state.plans = { ...state.plans, [key]: plan }
        state.monthPlan = plan
      },
    },
  ),
)
