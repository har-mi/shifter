import { z } from 'zod'
import type { MonthPlan } from '@/domain/types'
import { fi } from '@/i18n/fi'

/**
 * Zod schema for MonthPlan JSON import validation.
 * Ensures the imported JSON is well-formed before touching the store.
 */
const ShiftSchema = z.object({
  employeeId: z.enum(['A', 'B']),
  start: z.string(),
  end: z.string(),
  locked: z.boolean().optional(),
})

const DayPlanSchema = z.object({
  date: z.string(),
  shifts: z.array(ShiftSchema),
  note: z.string(),
  pdfComment: z.string(),
  isTravelDay: z.boolean(),
  dayOffMarks: z.record(z.enum(['A', 'B']), z.enum(['soft', 'hard']).nullable()),
})

export const MonthPlanSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  days: z.array(DayPlanSchema),
})

/**
 * Export the current month as JSON.
 * Filename format: tyovuorot_heinäkuu_2026.json
 */
export function exportMonthAsJson(monthPlan: MonthPlan): void {
  const monthName = fi.monthsGenitive[monthPlan.month - 1]
  const filename = `tyovuorot_${monthName}_${monthPlan.year}.json`

  try {
    const json = JSON.stringify(monthPlan, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('JSON export failed:', error)
    alert('Virhe: JSON-viennin epäonnistui. Katso konsoli (F12).')
  }
}

/**
 * Import a JSON file and validate it as a MonthPlan.
 * Returns the validated plan or null if invalid.
 */
export async function importMonthFromFile(
  file: File,
): Promise<MonthPlan | null> {
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    const validated = MonthPlanSchema.parse(json)
    return validated
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error('JSON validation failed:', error.issues)
      alert(
        `Virhe: JSON-tiedosto on virheellinen.\n\nValidointivirhe:\n${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n')}`,
      )
    } else if (error instanceof SyntaxError) {
      console.error('JSON parse failed:', error)
      alert('Virhe: JSON-tiedosto ei ole kelpo JSON. Katso konsoli (F12).')
    } else {
      console.error('Unexpected import error:', error)
      alert('Virhe: Tuntematon virhe JSON-tuonnissa. Katso konsoli (F12).')
    }
    return null
  }
}
