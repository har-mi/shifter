import { useMemo, useRef, useState } from 'react'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { DayEditor } from '@/components/calendar/DayEditor'
import { ViolationsPanel } from '@/components/ViolationsPanel'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dropdown } from '@/components/ui/Dropdown'
import { Drawer } from '@/components/ui/Drawer'
import { IconButton } from '@/components/ui/IconButton'
import { SettingsDialog } from '@/components/SettingsDialog'
import { ToastStack, type ToastMessage } from '@/components/ui/Toast'
import { validate } from '@/domain/constraints'
import { emptyMonthPlan } from '@/domain/monthPlan'
import { autoPlan, hasOverwritableShifts } from '@/planner/autoPlan'
import { employeeAccent } from '@/lib/employeeAccent'
import { fi } from '@/i18n/fi'
import { formatHours, totalHours } from '@/lib/time'
import { STORAGE_KEY, useAppStore } from '@/store/useAppStore'
import { exportMonthAsJson, importMonthFromFile } from '@/storage/jsonIO'
import { generateAndDownloadPNG } from '@/export/exportPng'
import { generateAndDownloadIcs } from '@/export/exportIcs'

export function CalendarPage() {
  const { monthPlan, settings, editingDate, setEditingDate, goToMonth, replaceMonthPlan, updateSettings } =
    useAppStore()
  const monthName = fi.months[monthPlan.month - 1]
  const [showViolations, setShowViolations] = useState(false)
  const [confirmAutoplan, setConfirmAutoplan] = useState(false)
  const [showClear, setShowClear] = useState(false)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [exporting, setExporting] = useState<null | 'pdf' | 'png'>(null)
  const nextToastIdRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addToast = (text: string, tone: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const id = nextToastIdRef.current++
    setToasts((prev) => [...prev, { id, text, tone }])
  }

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  /** Lazy-load PDF export only when needed */
  const handleExportPDFs = async () => {
    setExporting('pdf')
    try {
      addToast('Viedään PDF…')
      const { generateAndDownloadPDFs } = await import('@/export/generatePdf')
      await generateAndDownloadPDFs(monthPlan, settings)
    } catch (err) {
      console.error('PDF export failed:', err)
      addToast('PDF-vienti epäonnistui. Katso konsoli (F12).', 'error')
    } finally {
      setExporting(null)
    }
  }

  /** Lazy-load PNG export only when needed */
  const handleExportPNG = async () => {
    setExporting('png')
    try {
      addToast('Viedään kuvana…')
      await generateAndDownloadPNG(monthPlan)
    } catch (err) {
      console.error('PNG export failed:', err)
      addToast('PNG-vienti epäonnistui. Katso konsoli (F12).', 'error')
    } finally {
      setExporting(null)
    }
  }

  const totalsByEmployee = useMemo(() => {
    return settings.employees.map((emp) => {
      const shifts = monthPlan.days.flatMap((d) =>
        d.shifts.filter((s) => s.employeeId === emp.id),
      )
      const hours = totalHours(shifts)
      return { emp, hours }
    })
  }, [monthPlan, settings.employees])

  const violations = useMemo(
    () => validate(monthPlan, settings),
    [monthPlan, settings],
  )

  const editingDay = editingDate
    ? monthPlan.days.find((d) => d.date === editingDate)
    : null

  const handleSelectDay = (iso: string) => {
    setEditingDate(iso)
  }

  const shiftMonth = (delta: number) => {
    const m = monthPlan.month + delta
    let y = monthPlan.year
    let nm = m
    if (m < 1) {
      nm = 12
      y -= 1
    } else if (m > 12) {
      nm = 1
      y += 1
    }
    goToMonth(y, nm)
  }

  const goToToday = () => {
    const now = new Date()
    goToMonth(now.getFullYear(), now.getMonth() + 1)
  }

  const runAutoplan = () => {
    replaceMonthPlan(autoPlan(monthPlan, settings))
    setConfirmAutoplan(false)
  }

  const handleAutoplanClick = () => {
    if (hasOverwritableShifts(monthPlan)) {
      setConfirmAutoplan(true)
    } else {
      runAutoplan()
    }
  }

  const handleExportJson = () => {
    exportMonthAsJson(monthPlan)
  }

  const handleExportIcs = () => {
    const shiftCount = monthPlan.days.reduce((sum, d) => sum + d.shifts.length, 0)
    if (shiftCount === 0) {
      addToast(fi.toast.icsEmpty, 'info')
      return
    }
    const { skipped } = generateAndDownloadIcs(monthPlan, settings)
    if (skipped > 0) {
      addToast(fi.toast.icsSkipped(skipped), 'warn')
    } else {
      addToast(fi.toast.icsExported)
    }
  }

  const handleImportJson = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    const plan = await importMonthFromFile(file)
    if (plan) {
      goToMonth(plan.year, plan.month)
      replaceMonthPlan(plan)
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleClearAll = () => {
    // Clear all localStorage
    localStorage.removeItem(STORAGE_KEY)
    // Reload to reinitialize with fresh defaults
    window.location.reload()
  }

  const handleSaveEmployees = (updates: [{ name: string; monthlyHours: number }, { name: string; monthlyHours: number }]) => {
    updateSettings({
      employees: [
        { id: 'A', name: updates[0].name, monthlyHours: updates[0].monthlyHours },
        { id: 'B', name: updates[1].name, monthlyHours: updates[1].monthlyHours },
      ],
    })
    addToast(fi.settings.saved, 'success')
  }

  const clearShiftsOnly = () => {
    replaceMonthPlan({
      ...monthPlan,
      days: monthPlan.days.map((d) => ({ ...d, shifts: [] })),
    })
    setShowClear(false)
  }

  const clearEverything = () => {
    replaceMonthPlan(emptyMonthPlan(monthPlan.year, monthPlan.month))
    setShowClear(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6" data-calendar-container>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconButton
            label={fi.buttons.previousMonth}
            onClick={() => shiftMonth(-1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </IconButton>
          <h1 className="min-w-[220px] text-3xl font-semibold text-ink">
            {monthName} {monthPlan.year}
          </h1>
          <IconButton
            label={fi.buttons.nextMonth}
            onClick={() => shiftMonth(1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </IconButton>
          <Button variant="secondary" size="sm" onClick={goToToday} className="ml-2">
            {fi.buttons.today}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {totalsByEmployee.map(({ emp, hours }) => {
            const accent = employeeAccent[emp.id]
            const status = statusFor(hours, emp.monthlyHours)
            return (
              <div
                key={emp.id}
                className={`flex items-center gap-2 rounded-soft border px-3 py-2 text-sm ${accent.bg} ${accent.border}`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${accent.dot}`}>
                  {emp.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-medium text-ink">{emp.name}</span>
                <span className={`tabular-nums font-semibold ${status.color}`}>
                  {formatHours(hours).replace(' h', '')} / {emp.monthlyHours} h
                </span>
              </div>
            )
          })}
          <ViolationsBadge
            count={violations.length}
            open={showViolations}
            onClick={() => setShowViolations((s) => !s)}
          />
          <Button onClick={handleAutoplanClick} data-png-exclude>{fi.buttons.autoplan}</Button>
          <Dropdown
            label="Lisää toiminnot"
            buttonDataAttrs={{ 'data-png-exclude': '' }}
            sections={[
              {
                items: [
                  {
                    id: 'export-pdfs',
                    label: fi.buttons.exportPdfs,
                    onClick: handleExportPDFs,
                    disabled: exporting !== null,
                  },
                  {
                    id: 'export-png',
                    label: fi.buttons.exportPng,
                    onClick: handleExportPNG,
                    disabled: exporting !== null,
                  },
                ],
              },
              {
                items: [
                  {
                    id: 'export-json',
                    label: fi.buttons.exportJson,
                    onClick: handleExportJson,
                  },
                  {
                    id: 'import-json',
                    label: fi.buttons.importJson,
                    onClick: handleImportClick,
                  },
                  {
                    id: 'export-ics',
                    label: fi.buttons.exportIcs,
                    onClick: handleExportIcs,
                  },
                ],
              },
              {
                items: [
                  {
                    id: 'settings',
                    label: fi.buttons.settings,
                    onClick: () => setShowSettings(true),
                  },
                ],
              },
              {
                items: [
                  {
                    id: 'clear-month',
                    label: fi.clear.button,
                    onClick: () => setShowClear(true),
                  },
                  {
                    id: 'clear-all',
                    label: fi.buttons.clearAll,
                    onClick: () => setConfirmClearAll(true),
                  },
                ],
              },
            ]}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJson}
            style={{ display: 'none' }}
            aria-label="Tuo JSON"
          />
        </div>
      </div>

      {showViolations && (
        <div className="mb-4">
          <ViolationsPanel
            violations={violations}
            onJumpToDay={(iso) => {
              setShowViolations(false)
              setEditingDate(iso)
            }}
          />
        </div>
      )}

      <MonthCalendar onSelectDay={handleSelectDay} />

      <Drawer
        open={!!editingDay}
        onClose={() => setEditingDate(null)}
        title="Päivän muokkaus"
      >
        {editingDay && <DayEditor date={editingDay.date} day={editingDay} />}
      </Drawer>

      <ConfirmDialog
        open={confirmAutoplan}
        title={fi.autoplan.confirmTitle}
        message={fi.autoplan.confirmMessage}
        confirmLabel={fi.autoplan.confirmButton}
        onConfirm={runAutoplan}
        onCancel={() => setConfirmAutoplan(false)}
      />

      <ClearMonthDialog
        open={showClear}
        onCancel={() => setShowClear(false)}
        onClearShifts={clearShiftsOnly}
        onClearAll={clearEverything}
      />

      <ConfirmDialog
        open={confirmClearAll}
        title="Tyhjennä kaikki tiedot"
        message="Tämä poistaa KAIKKI sovelluksen tiedot pysyvästi, mukaan lukien kaikki kuukaudet ja asetukset. Toiminto ei ole peruutettavissa."
        confirmLabel={fi.buttons.clearAll}
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClearAll(false)}
      />

      <SettingsDialog
        open={showSettings}
        employees={settings.employees}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveEmployees}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

interface BadgeProps {
  count: number
  open: boolean
  onClick: () => void
}

function ViolationsBadge({ count, open, onClick }: BadgeProps) {
  if (count === 0) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      className={`flex items-center gap-2 rounded-soft border border-red-200 bg-red-100 px-3 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-200 ${
        open ? 'ring-2 ring-lavender-300' : ''
      }`}
    >
      <span aria-hidden>⚠</span>
      <span>{fi.violations.badge(count)}</span>
    </button>
  )
}

function statusFor(current: number, target: number): { color: string } {
  if (current === target) return { color: 'text-sage-600' }
  if (current > target) return { color: 'text-red-700' }
  return { color: 'text-ink-soft' }
}

interface ClearProps {
  open: boolean
  onCancel: () => void
  onClearShifts: () => void
  onClearAll: () => void
}

function ClearMonthDialog({ open, onCancel, onClearShifts, onClearAll }: ClearProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-title"
        className="w-full max-w-md rounded-soft border border-line bg-paper p-6 shadow-soft"
      >
        <h2 id="clear-title" className="mb-2 text-lg font-semibold text-ink">
          {fi.clear.title}
        </h2>
        <p className="mb-6 text-ink-soft">{fi.clear.message}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onClearShifts}
            className="inline-flex items-center justify-center rounded-soft bg-red-100 px-4 py-2 font-medium text-red-800 transition hover:bg-red-200"
          >
            {fi.clear.shiftsOnly}
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center justify-center rounded-soft bg-red-200 px-4 py-2 font-medium text-red-900 transition hover:bg-red-300"
          >
            {fi.clear.everything}
          </button>
          <Button variant="secondary" onClick={onCancel} className="mt-2">
            {fi.buttons.cancel}
          </Button>
        </div>
      </div>
    </div>
  )
}
