import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  clampDay,
  clampMonth,
  dayForKey,
  dayInRange,
  makeDay,
  monthForKey,
  monthInRange,
  monthWeeks,
  orderDays,
  sameDay,
  sameRange,
  startOfDay,
  startOfMonth,
} from './calendarDate'

const ymd = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]

describe('makeDay', () => {
  it('rolls over past either end of a month or year', () => {
    expect(ymd(makeDay(2026, 2, 0))).toEqual([2026, 2, 28])
    expect(ymd(makeDay(2026, 12, 1))).toEqual([2027, 1, 1])
    expect(ymd(makeDay(2026, 0, -1))).toEqual([2025, 12, 30])
  })

  it('takes a year below 100 as written', () => {
    expect(makeDay(99, 0, 1).getFullYear()).toBe(99)
  })
})

describe('startOfDay', () => {
  it('drops the time', () => {
    expect(startOfDay(new Date(2026, 10, 4, 23, 59, 59, 999))).toEqual(new Date(2026, 10, 4))
  })
})

describe('addMonths', () => {
  it('lands on the last of a shorter month', () => {
    expect(ymd(addMonths(makeDay(2026, 0, 31), 1))).toEqual([2026, 2, 28])
    expect(ymd(addMonths(makeDay(2028, 0, 31), 1))).toEqual([2028, 2, 29])
    expect(ymd(addMonths(makeDay(2026, 2, 31), -1))).toEqual([2026, 2, 28])
  })

  it('crosses years', () => {
    expect(ymd(addMonths(makeDay(2026, 11, 15), 1))).toEqual([2027, 1, 15])
    expect(ymd(addMonths(makeDay(2026, 0, 15), -12))).toEqual([2025, 1, 15])
  })
})

describe('addDays', () => {
  it('steps one day at a time through a whole year, whatever the clocks do', () => {
    let day = makeDay(2026, 0, 1)
    for (let i = 0; i < 365; i++) {
      const next = addDays(day, 1)
      expect(next.getTime()).toBeGreaterThan(day.getTime())
      day = next
    }
    expect(ymd(day)).toEqual([2027, 1, 1])
  })
})

describe('sameDay', () => {
  it('goes by the day alone', () => {
    expect(sameDay(new Date(2026, 10, 4, 1), new Date(2026, 10, 4, 22))).toBe(true)
    expect(sameDay(new Date(2026, 10, 4), new Date(2026, 10, 5))).toBe(false)
  })

  it('takes two nulls as the same, and a null as different to any day', () => {
    expect(sameDay(null, null)).toBe(true)
    expect(sameDay(null, new Date())).toBe(false)
    expect(sameDay(new Date(), null)).toBe(false)
  })
})

describe('dayInRange and clampDay', () => {
  const first = makeDay(2026, 10, 10)
  const last = makeDay(2026, 10, 20)

  it('counts both ends in', () => {
    expect(dayInRange(first, first, last)).toBe(true)
    expect(dayInRange(last, first, last)).toBe(true)
    expect(dayInRange(addDays(first, -1), first, last)).toBe(false)
    expect(dayInRange(addDays(last, 1), first, last)).toBe(false)
  })

  it('leaves an end out if it is null', () => {
    expect(dayInRange(makeDay(1900, 0, 1), null, last)).toBe(true)
    expect(dayInRange(makeDay(2900, 0, 1), first, null)).toBe(true)
  })

  it('brings a day back to the nearest end', () => {
    expect(clampDay(makeDay(2026, 10, 1), first, last)).toBe(first)
    expect(clampDay(makeDay(2026, 10, 30), first, last)).toBe(last)
    expect(ymd(clampDay(makeDay(2026, 10, 15), first, last))).toEqual([2026, 11, 15])
    expect(ymd(clampDay(makeDay(2026, 10, 30), null, null))).toEqual([2026, 11, 30])
  })
})

describe('monthWeeks', () => {
  it('is six weeks of seven days, starting on the first day of the week', () => {
    const weeks = monthWeeks(makeDay(2026, 10, 15), 1)
    expect(weeks).toHaveLength(6)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks.every((week) => week[0].getDay() === 1)).toBe(true)
  })

  it('lays out one run of days, covering the whole month', () => {
    const days = monthWeeks(makeDay(2026, 1, 15), 0).flat()
    days.slice(1).forEach((day, at) => expect(sameDay(day, addDays(days[at], 1))).toBe(true))
    expect(days.filter((day) => day.getMonth() === 1)).toHaveLength(28)
  })

  it('starts on the 1st where the month starts the week', () => {
    // 1 November 2026 is a Sunday.
    expect(ymd(monthWeeks(makeDay(2026, 10, 15), 0)[0][0])).toEqual([2026, 11, 1])
    expect(ymd(monthWeeks(makeDay(2026, 10, 15), 1)[0][0])).toEqual([2026, 10, 26])
    expect(ymd(monthWeeks(makeDay(2026, 10, 15), 6)[0][0])).toEqual([2026, 10, 31])
  })
})

describe('dayForKey', () => {
  // A Wednesday.
  const day = makeDay(2026, 10, 4)
  const keys = { shift: false, rtl: false, weekStart: 1 }

  it('moves by a day or a week with the arrows', () => {
    expect(ymd(dayForKey(day, 'ArrowLeft', keys)!)).toEqual([2026, 11, 3])
    expect(ymd(dayForKey(day, 'ArrowRight', keys)!)).toEqual([2026, 11, 5])
    expect(ymd(dayForKey(day, 'ArrowUp', keys)!)).toEqual([2026, 10, 28])
    expect(ymd(dayForKey(day, 'ArrowDown', keys)!)).toEqual([2026, 11, 11])
  })

  it('swaps left and right in text that runs right to left, but not up and down', () => {
    const rtl = { ...keys, rtl: true }
    expect(ymd(dayForKey(day, 'ArrowLeft', rtl)!)).toEqual([2026, 11, 5])
    expect(ymd(dayForKey(day, 'ArrowRight', rtl)!)).toEqual([2026, 11, 3])
    expect(ymd(dayForKey(day, 'ArrowDown', rtl)!)).toEqual([2026, 11, 11])
  })

  it('goes to either end of the week with Home and End, by the week of the locale', () => {
    expect(ymd(dayForKey(day, 'Home', keys)!)).toEqual([2026, 11, 2])
    expect(ymd(dayForKey(day, 'End', keys)!)).toEqual([2026, 11, 8])
    expect(ymd(dayForKey(day, 'Home', { ...keys, weekStart: 0 })!)).toEqual([2026, 11, 1])
    expect(ymd(dayForKey(day, 'End', { ...keys, weekStart: 0 })!)).toEqual([2026, 11, 7])
  })

  it('moves by a month with Page Up and Down, or with Shift by a year', () => {
    expect(ymd(dayForKey(day, 'PageUp', keys)!)).toEqual([2026, 10, 4])
    expect(ymd(dayForKey(day, 'PageDown', keys)!)).toEqual([2026, 12, 4])
    expect(ymd(dayForKey(day, 'PageUp', { ...keys, shift: true })!)).toEqual([2025, 11, 4])
    expect(ymd(dayForKey(day, 'PageDown', { ...keys, shift: true })!)).toEqual([2027, 11, 4])
  })

  it('leaves any other key alone', () => {
    expect(dayForKey(day, 'Enter', keys)).toBeUndefined()
    expect(dayForKey(day, 'a', keys)).toBeUndefined()
  })
})

describe('startOfMonth', () => {
  it('goes back to the first of the month', () => {
    expect(ymd(startOfMonth(makeDay(2026, 10, 30)))).toEqual([2026, 11, 1])
  })
})

describe('monthInRange', () => {
  const first = makeDay(2026, 2, 31)
  const last = makeDay(2026, 10, 1)

  it('counts a month with only its last or first day in range', () => {
    expect(monthInRange(makeDay(2026, 2, 1), first, last)).toBe(true)
    expect(monthInRange(makeDay(2026, 10, 1), first, last)).toBe(true)
  })

  it('leaves out the months either side', () => {
    expect(monthInRange(makeDay(2026, 1, 1), first, last)).toBe(false)
    expect(monthInRange(makeDay(2026, 11, 1), first, last)).toBe(false)
  })

  it('leaves an end out if it is null', () => {
    expect(monthInRange(makeDay(1900, 0, 1), null, last)).toBe(true)
    expect(monthInRange(makeDay(2900, 0, 1), first, null)).toBe(true)
  })
})

describe('clampMonth', () => {
  const first = makeDay(2026, 2, 31)
  const last = makeDay(2026, 10, 1)

  it('gives the first of the month, even of a month whose first day is out of range', () => {
    expect(ymd(clampMonth(makeDay(2026, 5, 20), first, last))).toEqual([2026, 6, 1])
    expect(ymd(clampMonth(makeDay(2026, 2, 31), first, last))).toEqual([2026, 3, 1])
  })

  it('brings a month back to the nearest end', () => {
    expect(ymd(clampMonth(makeDay(2020, 0, 1), first, last))).toEqual([2026, 3, 1])
    expect(ymd(clampMonth(makeDay(2030, 0, 1), first, last))).toEqual([2026, 11, 1])
  })
})

describe('monthForKey', () => {
  const month = makeDay(2026, 4, 1)
  const keys = { shift: false, rtl: false }

  it('moves by a month sideways and three up and down, as the months are laid out', () => {
    expect(ymd(monthForKey(month, 'ArrowLeft', keys)!)).toEqual([2026, 4, 1])
    expect(ymd(monthForKey(month, 'ArrowRight', keys)!)).toEqual([2026, 6, 1])
    expect(ymd(monthForKey(month, 'ArrowUp', keys)!)).toEqual([2026, 2, 1])
    expect(ymd(monthForKey(month, 'ArrowDown', keys)!)).toEqual([2026, 8, 1])
  })

  it('walks out of one year and into the next', () => {
    expect(ymd(monthForKey(makeDay(2026, 11, 1), 'ArrowRight', keys)!)).toEqual([2027, 1, 1])
    expect(ymd(monthForKey(makeDay(2026, 0, 1), 'ArrowUp', keys)!)).toEqual([2025, 10, 1])
  })

  it('swaps left and right in text that runs right to left, but not up and down', () => {
    const rtl = { ...keys, rtl: true }
    expect(ymd(monthForKey(month, 'ArrowLeft', rtl)!)).toEqual([2026, 6, 1])
    expect(ymd(monthForKey(month, 'ArrowRight', rtl)!)).toEqual([2026, 4, 1])
    expect(ymd(monthForKey(month, 'ArrowDown', rtl)!)).toEqual([2026, 8, 1])
  })

  it('goes to either end of the year with Home and End', () => {
    expect(ymd(monthForKey(month, 'Home', keys)!)).toEqual([2026, 1, 1])
    expect(ymd(monthForKey(month, 'End', keys)!)).toEqual([2026, 12, 1])
  })

  it('moves by a year with Page Up and Down, or with Shift by ten', () => {
    expect(ymd(monthForKey(month, 'PageUp', keys)!)).toEqual([2025, 5, 1])
    expect(ymd(monthForKey(month, 'PageDown', keys)!)).toEqual([2027, 5, 1])
    expect(ymd(monthForKey(month, 'PageUp', { ...keys, shift: true })!)).toEqual([2016, 5, 1])
    expect(ymd(monthForKey(month, 'PageDown', { ...keys, shift: true })!)).toEqual([2036, 5, 1])
  })

  it('leaves any other key alone', () => {
    expect(monthForKey(month, 'Enter', keys)).toBeUndefined()
  })
})

describe('orderDays', () => {
  const early = makeDay(2026, 10, 4)
  const late = makeDay(2026, 10, 8)

  it('puts two days the right way round, either way they come', () => {
    expect(orderDays(early, late)).toEqual({ start: early, end: late })
    expect(orderDays(late, early)).toEqual({ start: early, end: late })
  })

  it('takes one day twice', () => {
    expect(orderDays(early, early)).toEqual({ start: early, end: early })
  })
})

describe('sameRange', () => {
  const range = { start: makeDay(2026, 10, 4), end: makeDay(2026, 10, 8) }

  it('goes by both ends, by the day alone', () => {
    expect(sameRange(range, { start: new Date(2026, 10, 4, 9), end: new Date(2026, 10, 8, 18) })).toBe(true)
    expect(sameRange(range, { ...range, end: makeDay(2026, 10, 9) })).toBe(false)
    expect(sameRange(range, { ...range, start: makeDay(2026, 10, 3) })).toBe(false)
  })

  it('takes two nulls as the same, and a null as different to any range', () => {
    expect(sameRange(null, null)).toBe(true)
    expect(sameRange(null, range)).toBe(false)
    expect(sameRange(range, null)).toBe(false)
  })
})
