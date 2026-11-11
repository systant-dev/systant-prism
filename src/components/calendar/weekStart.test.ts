import { afterEach, describe, expect, it, vi } from 'vitest'
import { weekStart } from './weekStart'

afterEach(() => {
  vi.restoreAllMocks()
})

const SUNDAY = 0
const MONDAY = 1
const SATURDAY = 6

const cases: [string, number][] = [
  ['en-GB', MONDAY],
  ['en-US', SUNDAY],
  ['de-DE', MONDAY],
  ['ar-EG', SATURDAY],
  ['ja-JP', SUNDAY],
  // No region of its own, so the one it most likely means.
  ['en', SUNDAY],
  ['fr', MONDAY],
]

describe('weekStart', () => {
  it.each(cases)('starts the week of %s from Intl.Locale', (locale, day) => {
    expect(weekStart(locale)).toBe(day)
  })

  describe('in a browser with no week information', () => {
    it.each(cases)('starts the week of %s from its own list', (locale, day) => {
      vi.spyOn(Intl.Locale.prototype, 'getWeekInfo' as never).mockReturnValue(undefined as never)
      expect(weekStart(locale)).toBe(day)
    })
  })

  it('takes the older getter', () => {
    vi.spyOn(Intl.Locale.prototype, 'getWeekInfo' as never).mockReturnValue(undefined as never)
    Object.defineProperty(Intl.Locale.prototype, 'weekInfo', { configurable: true, get: () => ({ firstDay: 6 }) })
    try {
      expect(weekStart('en-US')).toBe(SATURDAY)
    } finally {
      Reflect.deleteProperty(Intl.Locale.prototype, 'weekInfo')
    }
  })
})
