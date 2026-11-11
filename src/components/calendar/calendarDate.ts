// Calendar days as local Dates, each the first moment of its day. Arithmetic is on
// the year, month and day, never on milliseconds: a day is 23 or 25 hours long
// where the clocks change, and in some places midnight itself is skipped.

/**
 * The first moment of a local day. A `month` or `day` past either end of its range
 * rolls over, so day 0 is the last of the month before. setFullYear, as the Date
 * constructor takes years 0 to 99 for 1900 to 1999.
 */
export function makeDay(year: number, month: number, day: number) {
  const date = new Date(2000, 0, 1)
  date.setFullYear(year, month, day)
  return date
}

export function startOfDay(date: Date) {
  return makeDay(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(day: Date, count: number) {
  return makeDay(day.getFullYear(), day.getMonth(), day.getDate() + count)
}

/** The same day `count` months away, or the last of that month if it is shorter. */
export function addMonths(day: Date, count: number) {
  const year = day.getFullYear()
  const month = day.getMonth() + count
  return makeDay(year, month, Math.min(day.getDate(), makeDay(year, month + 1, 0).getDate()))
}

export function sameDay(a: Date | null, b: Date | null) {
  return a === null || b === null ? a === b : startOfDay(a).getTime() === startOfDay(b).getTime()
}

/** Whether `day` lies between `first` and `last`, inclusive, either of which can be left open. */
export function dayInRange(day: Date, first: Date | null, last: Date | null) {
  return (!first || day >= first) && (!last || day <= last)
}

/** The nearest day to `day` between `first` and `last`. */
export function clampDay(day: Date, first: Date | null, last: Date | null) {
  if (first && day < first) return first
  if (last && day > last) return last
  return day
}

/** How many days into its week `day` is, where weeks start on `weekStart` (0 for Sunday). */
function daysIntoWeek(day: Date, weekStart: number) {
  return (day.getDay() - weekStart + 7) % 7
}

/**
 * Six weeks of seven days each, covering the month `day` lies in: always six, so a
 * calendar stays one height from month to month and never moves under the pointer.
 */
export function monthWeeks(day: Date, weekStart: number) {
  const year = day.getFullYear()
  const month = day.getMonth()
  const lead = daysIntoWeek(makeDay(year, month, 1), weekStart)
  const count = (length: number) => Array.from({ length }, (_, at) => at)
  return count(6).map((week) => count(7).map((weekday) => makeDay(year, month, 1 - lead + week * 7 + weekday)))
}

export interface DayKeyOptions {
  /** Shift is held: Page Up and Page Down move by a year rather than a month. */
  shift: boolean
  /** The text runs right to left, and so the days of the week do too. */
  rtl: boolean
  /** The first day of the week, 0 for Sunday. */
  weekStart: number
}

/** The day a key moves to from `day`, or undefined for a key it leaves alone. */
export function dayForKey(day: Date, key: string, { shift, rtl, weekStart }: DayKeyOptions) {
  if (key === 'ArrowLeft') return addDays(day, rtl ? 1 : -1)
  if (key === 'ArrowRight') return addDays(day, rtl ? -1 : 1)
  if (key === 'ArrowUp') return addDays(day, -7)
  if (key === 'ArrowDown') return addDays(day, 7)
  if (key === 'Home') return addDays(day, -daysIntoWeek(day, weekStart))
  if (key === 'End') return addDays(day, 6 - daysIntoWeek(day, weekStart))
  if (key === 'PageUp') return addMonths(day, shift ? -12 : -1)
  if (key === 'PageDown') return addMonths(day, shift ? 12 : 1)
}

export function startOfMonth(day: Date) {
  return makeDay(day.getFullYear(), day.getMonth(), 1)
}

/** Whether any day of the month `month` lies in can be picked between `first` and `last`. */
export function monthInRange(month: Date, first: Date | null, last: Date | null) {
  const year = month.getFullYear()
  const at = month.getMonth()
  return (!first || makeDay(year, at + 1, 0) >= first) && (!last || makeDay(year, at, 1) <= last)
}

/** The first of the nearest month to `month` that holds a day between `first` and `last`. */
export function clampMonth(month: Date, first: Date | null, last: Date | null) {
  return clampDay(startOfMonth(month), first && startOfMonth(first), last && startOfMonth(last))
}

/** How many months there are in a year. */
export const YEAR = 12
/** How many months there are in ten years. */
export const DECADE = 120

/** The month a key moves to from `month`, in a year view three months wide, or undefined for a key it leaves alone. */
export function monthForKey(month: Date, key: string, { shift, rtl }: Pick<DayKeyOptions, 'shift' | 'rtl'>) {
  if (key === 'ArrowLeft') return addMonths(month, rtl ? 1 : -1)
  if (key === 'ArrowRight') return addMonths(month, rtl ? -1 : 1)
  if (key === 'ArrowUp') return addMonths(month, -3)
  if (key === 'ArrowDown') return addMonths(month, 3)
  if (key === 'Home') return makeDay(month.getFullYear(), 0, 1)
  if (key === 'End') return makeDay(month.getFullYear(), 11, 1)
  if (key === 'PageUp') return addMonths(month, -(shift ? DECADE : YEAR))
  if (key === 'PageDown') return addMonths(month, shift ? DECADE : YEAR)
}

/** A run of days from `start` to `end`, both included. One day is a range of its own, with `start` the same as `end`. */
export interface CalendarRange {
  start: Date
  end: Date
}

/** The range between two days, given either way round. */
export function orderDays(a: Date, b: Date): CalendarRange {
  return a <= b ? { start: a, end: b } : { start: b, end: a }
}

export function sameRange(a: CalendarRange | null, b: CalendarRange | null) {
  return a === null || b === null ? a === b : sameDay(a.start, b.start) && sameDay(a.end, b.end)
}
