import { useCallback, useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { fi } from '@/i18n/fi'
import type { Employee } from '@/domain/types'

interface EmployeeUpdate {
  name: string
  monthlyHours: number
}

interface Props {
  open: boolean
  employees: Employee[]
  onClose: () => void
  onSave: (updates: [EmployeeUpdate, EmployeeUpdate]) => void
}

export function SettingsDialog({ open, employees, onClose, onSave }: Props) {
  const [updates, setUpdates] = useState<[EmployeeUpdate, EmployeeUpdate]>([
    { name: employees[0].name, monthlyHours: employees[0].monthlyHours },
    { name: employees[1].name, monthlyHours: employees[1].monthlyHours },
  ])
  const [errors, setErrors] = useState<[{ name: boolean; hours: boolean }, { name: boolean; hours: boolean }]>([
    { name: false, hours: false },
    { name: false, hours: false },
  ])

  // Reset state when dialog opens or when employees prop changes
  useEffect(() => {
    if (open) {
      setUpdates([
        { name: employees[0].name, monthlyHours: employees[0].monthlyHours },
        { name: employees[1].name, monthlyHours: employees[1].monthlyHours },
      ])
      setErrors([
        { name: false, hours: false },
        { name: false, hours: false },
      ])
    }
  }, [open, employees])

  const focusSave = useCallback((node: HTMLButtonElement | null) => {
    node?.focus()
  }, [])

  const handleNameChange = (idx: 0 | 1, value: string) => {
    setUpdates((prev) => {
      const updated: [EmployeeUpdate, EmployeeUpdate] = [...prev]
      updated[idx] = { ...updated[idx], name: value }
      return updated
    })
    setErrors((prev) => {
      const updated: [{ name: boolean; hours: boolean }, { name: boolean; hours: boolean }] = [...prev]
      updated[idx] = { ...updated[idx], name: false }
      return updated
    })
  }

  const handleHoursChange = (idx: 0 | 1, value: string) => {
    const num = parseFloat(value)
    setUpdates((prev) => {
      const updated: [EmployeeUpdate, EmployeeUpdate] = [...prev]
      updated[idx] = { ...updated[idx], monthlyHours: isNaN(num) ? 0 : num }
      return updated
    })
    setErrors((prev) => {
      const updated: [{ name: boolean; hours: boolean }, { name: boolean; hours: boolean }] = [...prev]
      updated[idx] = { ...updated[idx], hours: false }
      return updated
    })
  }

  const handleSave = () => {
    const trimmedNames: [string, string] = [updates[0].name.trim(), updates[1].name.trim()]
    const isValidHours = (val: number) => {
      // Check if value is in range [0, 250] and is a multiple of 0.5
      return !isNaN(val) && val >= 0 && val <= 250 && (val * 2) % 1 === 0
    }

    const newErrors: [{ name: boolean; hours: boolean }, { name: boolean; hours: boolean }] = [
      {
        name: trimmedNames[0].length === 0,
        hours: !isValidHours(updates[0].monthlyHours),
      },
      {
        name: trimmedNames[1].length === 0,
        hours: !isValidHours(updates[1].monthlyHours),
      },
    ]

    if (newErrors[0].name || newErrors[0].hours || newErrors[1].name || newErrors[1].hours) {
      setErrors(newErrors)
      return
    }

    onSave([
      { name: trimmedNames[0], monthlyHours: updates[0].monthlyHours },
      { name: trimmedNames[1], monthlyHours: updates[1].monthlyHours },
    ])
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-md rounded-soft bg-paper shadow-soft border border-line p-6"
      >
        <h2 id="settings-title" className="mb-4 text-lg font-semibold text-ink">
          {fi.settings.title}
        </h2>

        <div className="mb-6 space-y-5">
          {[0, 1].map((idx) => (
            <div key={idx} className="space-y-3 pb-4 border-b border-line last:border-b-0 last:pb-0">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">
                  {fi.settings.nameLabel} {idx + 1}
                </label>
                <input
                  type="text"
                  value={updates[idx as 0 | 1].name}
                  onChange={(e) => handleNameChange(idx as 0 | 1, e.target.value)}
                  maxLength={30}
                  className={`w-full rounded-soft border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 ${
                    errors[idx as 0 | 1].name
                      ? 'border-red-400 bg-red-50 text-ink focus:ring-red-300'
                      : 'border-line bg-cream-50 text-ink focus:ring-lavender-300'
                  }`}
                  placeholder={employees[idx as 0 | 1].name}
                />
                {errors[idx as 0 | 1].name && (
                  <p className="mt-1 text-xs text-red-700">{fi.settings.nameRequired}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">
                  {fi.settings.monthlyHoursLabel}
                </label>
                <input
                  type="number"
                  value={updates[idx as 0 | 1].monthlyHours}
                  onChange={(e) => handleHoursChange(idx as 0 | 1, e.target.value)}
                  min={0}
                  max={250}
                  step={0.5}
                  className={`w-full rounded-soft border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 ${
                    errors[idx as 0 | 1].hours
                      ? 'border-red-400 bg-red-50 text-ink focus:ring-red-300'
                      : 'border-line bg-cream-50 text-ink focus:ring-lavender-300'
                  }`}
                  placeholder={String(employees[idx as 0 | 1].monthlyHours)}
                />
                {errors[idx as 0 | 1].hours && (
                  <p className="mt-1 text-xs text-red-700">{fi.settings.hoursInvalid}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {fi.buttons.cancel}
          </Button>
          <button
            ref={focusSave}
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 rounded-soft px-4 py-2 font-medium shadow-soft transition bg-lavender-400 text-white hover:bg-lavender-500"
          >
            {fi.buttons.save}
          </button>
        </div>
      </div>
    </div>
  )
}
