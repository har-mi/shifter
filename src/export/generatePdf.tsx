import type { Settings, MonthPlan } from '@/domain/types'
import { fi } from '@/i18n/fi'

/**
 * Lazy-loaded PDF export. Only imported when user clicks the export button.
 * Generates PDFs for both employees and triggers downloads.
 */
export async function generateAndDownloadPDFs(
  monthPlan: MonthPlan,
  settings: Settings,
) {
  const { pdf } = await import('@react-pdf/renderer')
  const { EmployeeSchedulePDF } = await import('./EmployeeSchedulePDF')

  const monthName = fi.monthsGenitive[monthPlan.month - 1]
  const filename = (empName: string) =>
    `${empName.toLowerCase()}_${monthName}_${monthPlan.year}.pdf`

  for (const employee of settings.employees) {
    try {
      const doc = (
        <EmployeeSchedulePDF employee={employee} monthPlan={monthPlan} />
      )
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename(employee.name)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(`PDF generation failed for ${employee.name}:`, error)
      alert(
        `Virhe: PDF:n luominen epäonnistui kohteelle ${employee.name}. Katso konsoli (F12).`,
      )
    }
  }
}
