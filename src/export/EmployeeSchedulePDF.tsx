import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import type { Employee, MonthPlan } from '@/domain/types'
import { fi } from '@/i18n/fi'
import { shiftHours, formatHours } from '@/lib/time'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#999',
  },
  headerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerMonth: {
    fontSize: 12,
    color: '#666',
  },
  table: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 6,
    fontSize: 10,
  },
  datecell: {
    width: '12%',
  },
  weekdaycell: {
    width: '15%',
  },
  timecell: {
    width: '15%',
  },
  durationcell: {
    width: '12%',
  },
  commentcell: {
    width: '46%',
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#999',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontWeight: 'bold',
  },
  footerValue: {
    fontWeight: 'bold',
  },
})

interface EmployeeSchedulePDFProps {
  employee: Employee
  monthPlan: MonthPlan
}

export function EmployeeSchedulePDF({
  employee,
  monthPlan,
}: EmployeeSchedulePDFProps) {
  const monthName = fi.months[monthPlan.month - 1]

  // Collect all work days for this employee
  const workDays = monthPlan.days
    .filter((day) => day.shifts.some((s) => s.employeeId === employee.id))
    .map((day) => {
      const empShifts = day.shifts.filter((s) => s.employeeId === employee.id)
      const date = parseISO(day.date)
      const weekdayIndex = (date.getDay() + 6) % 7 // Mon=0
      const weekday = fi.weekdaysShort[weekdayIndex].toUpperCase()

      return {
        date: day.date,
        weekday,
        day,
        shifts: empShifts,
      }
    })

  // Calculate total hours
  const totalHours = workDays.reduce((sum, wd) => {
    return (
      sum +
      wd.shifts.reduce(
        (daySum, shift) => daySum + shiftHours(shift.start, shift.end),
        0
      )
    )
  }, 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerName}>{employee.name}</Text>
          <Text style={styles.headerMonth}>
            {monthName} {monthPlan.year}
          </Text>
        </View>

        <View style={styles.table}>
          {/* Header row */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.datecell]}>
              {fi.shift.date}
            </Text>
            <Text style={[styles.tableCell, styles.weekdaycell]}>
              {fi.shift.weekday}
            </Text>
            <Text style={[styles.tableCell, styles.timecell]}>
              {fi.shift.start}
            </Text>
            <Text style={[styles.tableCell, styles.timecell]}>
              {fi.shift.end}
            </Text>
            <Text style={[styles.tableCell, styles.durationcell]}>
              {fi.shift.duration}
            </Text>
            <Text style={[styles.tableCell, styles.commentcell]}>
              {fi.shift.comment}
            </Text>
          </View>

          {/* Data rows */}
          {workDays.map((wd, idx) => {
            const shift = wd.shifts[0]
            return (
              <View key={`${wd.date}-${idx}`} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.datecell]}>
                  {format(parseISO(wd.date), 'd.M.yyyy')}
                </Text>
                <Text style={[styles.tableCell, styles.weekdaycell]}>
                  {wd.weekday.substring(0, 3)}
                </Text>
                <Text style={[styles.tableCell, styles.timecell]}>
                  {shift.start}
                </Text>
                <Text style={[styles.tableCell, styles.timecell]}>
                  {shift.end}
                </Text>
                <Text style={[styles.tableCell, styles.durationcell]}>
                  {formatHours(shiftHours(shift.start, shift.end))}
                </Text>
                <Text style={[styles.tableCell, styles.commentcell]}>
                  {wd.day.pdfComment}
                </Text>
              </View>
            )
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Yhteensä:</Text>
          <Text style={styles.footerValue}>{formatHours(totalHours)}</Text>
        </View>
      </Page>
    </Document>
  )
}
