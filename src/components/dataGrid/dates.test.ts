import { describe, expect, it } from 'vitest'
import { formatDate, makeDay } from '../calendar'
import { dayOf, formatDay, withinDays } from './dates'
import type { GridColumn } from './types'

const column = (locale: string, mask: string | null = null): GridColumn => ({
  key: 'day',
  header: 'day',
  type: 'date',
  options: [],
  filterable: true,
  summary: null,
  mask,
  saveMask: true,
  locale,
  currency: '',
  width: null,
  resizable: true,
})

describe('formatDay', () => {
  it('writes a day as the Calendar does, on the Gregorian calendar whatever the locale’s own', () => {
    const day = makeDay(2026, 10, 9)
    expect(formatDay('2026-11-09', column('en-GB'))).toBe('9 Nov 2026')
    // Thai counts Buddhist years (2569) and Persian its own months, unless told otherwise.
    for (const locale of ['th-TH', 'fa-IR']) {
      expect(formatDay('2026-11-09', column(locale))).toBe(formatDate(day, { dateStyle: 'medium' }, locale))
    }
    expect(formatDay('2026-11-09', column('th-TH'))).toContain('2026')
    expect(formatDay('2026-11-09', column('en-GB', 'dd/MM/yyyy'))).toBe('09/11/2026')
    expect(formatDay('soon', column('en-GB'))).toBe('soon')
  })
})

describe('dayOf', () => {
  it('reads a day that exists, even in a year below 100, and none that does not', () => {
    expect(dayOf('0050-01-10')?.getFullYear()).toBe(50)
    expect(dayOf('2026-02-31')).toBeNull()
  })
})

describe('withinDays', () => {
  it('takes in the whole of the last day', () => {
    const range = { start: makeDay(2026, 10, 1), end: makeDay(2026, 10, 9) }
    expect(withinDays('2026-11-09T23:59:00', range)).toBe(true)
    expect(withinDays('2026-11-10', range)).toBe(false)
    expect(withinDays('2026-10-31', range)).toBe(false)
  })

  it('finds a day in a year below 100, which new Date(y, m, d) would take for 19xx', () => {
    const day = makeDay(50, 0, 10)
    expect(withinDays(day, { start: day, end: day })).toBe(true)
  })
})
