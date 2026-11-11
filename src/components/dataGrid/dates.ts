import { addDays, formatDate, makeDay, startOfDay, type CalendarDateFormat, type CalendarRange } from '../calendar'
import { plainText } from './text'
import type { GridColumn, GridFilter } from './types'

// What date columns do with their values: read them as days, write them, and find them in a run of days.

/**
 * The local day an ISO date ('2026-11-09') or timestamp names, or null for
 * anything else, a day that doesn't exist ('2026-02-31') included.
 */
export function dayOf(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string' || !value) return null
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (bare) return localDay(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]))
  const day = new Date(value)
  return Number.isNaN(day.getTime()) ? null : day
}

/**
 * A day where the reader is, or null where there is no such day: the calendar's
 * makeDay rolls 31 February over into March, which here is no day at all. Not
 * new Date('2026-11-09'): that is midnight UTC, the day before west of Greenwich.
 */
function localDay(year: number, month: number, date: number) {
  const day = makeDay(year, month, date)
  return day.getFullYear() === year && day.getMonth() === month && day.getDate() === date ? day : null
}

/** A day as an ISO date, '2026-11-09', as it is stored. */
export function isoDay(day: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(day.getFullYear()).padStart(4, '0')}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

/** As a Calendar writes a date by default: 9 Nov 2026 in en-GB. */
const MEDIUM_DATE: CalendarDateFormat = { dateStyle: 'medium' }

/**
 * A date as its column's mask writes it, or else as its locale does, or as it
 * came if it isn't one. Written as the Calendar writes it, on the Gregorian
 * calendar whatever the locale's own, so a cell shows the year its editor and
 * filter do (2026 in th-TH, not the Buddhist 2569).
 */
export function formatDay(value: unknown, column: GridColumn) {
  const day = dayOf(value)
  if (!day) return plainText(value)
  return formatDate(day, column.mask ?? MEDIUM_DATE, column.locale)
}

/** Whether a filter is a run of days, as a date column's calendar picks. */
export function isDays(filter: GridFilter | undefined): filter is CalendarRange {
  return typeof filter === 'object' && !Array.isArray(filter)
}

/**
 * Whether a date falls on a day of `days`, the last included: a timestamp late on
 * the last day counts. Anything that isn't a date falls outside.
 */
export function withinDays(value: unknown, { start, end }: CalendarRange) {
  const day = dayOf(value)
  if (!day) return false
  return day >= startOfDay(start) && day < addDays(end, 1)
}
