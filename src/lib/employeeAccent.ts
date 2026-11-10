import type { EmployeeId } from '@/domain/types'

/**
 * Per-employee accent colors so the calendar is instantly scannable.
 * Returns Tailwind class fragments — `bg-…`, `text-…`, `border-…`.
 */
export const employeeAccent: Record<EmployeeId, { bg: string; text: string; border: string; dot: string }> = {
  A: {
    bg: 'bg-lavender-200',
    text: 'text-lavender-500',
    border: 'border-lavender-300',
    dot: 'bg-lavender-400',
  },
  B: {
    bg: 'bg-sage-200',
    text: 'text-sage-500',
    border: 'border-sage-300',
    dot: 'bg-sage-400',
  },
}
