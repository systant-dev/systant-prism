import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dateFormatter,
  fieldText,
  formatDate,
  formatRange,
  parseDate,
  parseRange,
  type CalendarDateFormat,
} from './dateFormat'

// A Wednesday.
const date = new Date(2026, 10, 4)
const march = new Date(2026, 2, 4)

afterEach(() => {
  vi.useRealTimers()
})

describe('formatDate', () => {
  it.each([
    ['dd/MM/yyyy', '04/11/2026'],
    ['d/M/yy', '4/11/26'],
    ['yyyy-MM-dd', '2026-11-04'],
    ['d MMM yyyy', '4 Nov 2026'],
    ['d MMMM yyyy', '4 November 2026'],
    ['EEE d MMM', 'Wed 4 Nov'],
    ['EEEE, d MMMM', 'Wednesday, 4 November'],
  ])('writes %s', (pattern, written) => {
    expect(formatDate(date, pattern, 'en-GB')).toBe(written)
  })

  it('pads a month and day that need it', () => {
    expect(formatDate(march, 'dd/MM', 'en-GB')).toBe('04/03')
    expect(formatDate(march, 'd/M', 'en-GB')).toBe('4/3')
  })

  it('takes quoted text as it stands, with two quotes for a quote', () => {
    expect(formatDate(date, "'day' d 'of' MMMM", 'en-GB')).toBe('day 4 of November')
    expect(formatDate(date, "d MMM ''yy", 'en-GB')).toBe("4 Nov '26")
  })

  it('leaves other letters alone', () => {
    expect(formatDate(date, 'yyyy-MM-ddT', 'en-GB')).toBe('2026-11-04T')
  })

  it('writes the names of a pattern in the locale', () => {
    expect(formatDate(date, 'd MMMM yyyy', 'fr-FR')).toBe('4 novembre 2026')
    expect(formatDate(date, 'EEEE', 'de-DE')).toBe('Mittwoch')
  })

  it("takes the form of a month's name that its neighbours call for", () => {
    expect(formatDate(date, 'd MMMM', 'ru-RU')).toBe('4 ноября')
    expect(formatDate(date, 'MMMM yyyy', 'ru-RU')).toBe('ноябрь 2026')
  })

  it("writes a pattern's numbers in the locale's numerals, without what it writes round a lone field", () => {
    expect(formatDate(date, 'dd/MM', 'ar-EG')).toBe('٠٤/١١')
    expect(formatDate(date, 'd/M', 'ja-JP')).toBe('4/11')
  })

  it("orders Intl's options as the locale does", () => {
    const format = { dateStyle: 'short' } as const
    expect(formatDate(date, format, 'en-GB')).toBe('04/11/2026')
    expect(formatDate(date, format, 'en-US')).toBe('11/4/26')
    expect(formatDate(date, format, 'de-DE')).toBe('04.11.26')
  })

  it('stays on the Gregorian calendar, whatever the locale would use, as the grid does', () => {
    const format = { year: 'numeric', month: 'numeric', day: 'numeric' } as const
    expect(formatDate(date, format, 'th-TH')).toContain('2026')
    expect(formatDate(date, 'yyyy', 'th-TH')).toBe('2026')
    expect(formatDate(date, format, 'en-u-ca-buddhist')).toContain('2026')
  })
})

describe('fieldText', () => {
  it('finds the field alone in what a locale writes round it', () => {
    expect(dateFormatter('ja-JP', { day: 'numeric' }).format(date)).toBe('4日')
    expect(fieldText(dateFormatter('ja-JP', { day: 'numeric' }), date, 'day')).toBe('4')
  })
})

describe('parseDate', () => {
  it('reads back all it writes', () => {
    const formats: CalendarDateFormat[] = [
      'dd/MM/yyyy',
      'd/M/yy',
      'yyyy-MM-dd',
      'yyyyMMdd',
      'd MMM yyyy',
      'EEEE, d MMMM yyyy',
      "'day' d 'of' MMMM yyyy",
      { dateStyle: 'short' },
      { dateStyle: 'medium' },
      { dateStyle: 'long' },
      { dateStyle: 'full' },
    ]
    const locales = ['en-GB', 'en-US', 'de-DE', 'fr-FR', 'es-ES', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN', 'ar-EG', 'he-IL']
    const days = [date, march, new Date(2026, 0, 31), new Date(1999, 11, 25)]
    for (const format of formats) {
      for (const locale of locales) {
        for (const day of days) {
          const written = formatDate(day, format, locale)
          expect([locale, format, written, parseDate(written, format, locale)]).toEqual([locale, format, written, day])
        }
      }
    }
  })

  it('reads the field names of Vietnamese, which end in a number', () => {
    const written = formatDate(date, { dateStyle: 'medium' }, 'vi-VN')
    expect(parseDate(written, { dateStyle: 'medium' }, 'vi-VN')).toEqual(date)
  })

  it('goes by the order of the format, not one guessed at', () => {
    expect(parseDate('04/11/2026', 'dd/MM/yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('04/11/2026', 'MM/dd/yyyy', 'en-GB')).toEqual(new Date(2026, 3, 11))
  })

  it('takes single digits, a space round it and any punctuation', () => {
    expect(parseDate('4/11/2026', 'dd/MM/yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('  04-11-2026 ', 'dd/MM/yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('4.11.2026', 'dd/MM/yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('4 11 2026', 'dd/MM/yyyy', 'en-GB')).toEqual(date)
  })

  it('takes a month by name or number, in any case, whichever the format writes', () => {
    expect(parseDate('4 NOV 2026', 'd MMM yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('4 november 2026', 'd MMM yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('4 11 2026', 'd MMM yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('4 Nov 2026', 'd/MM/yyyy', 'en-GB')).toEqual(date)
  })

  it("doesn't mind the accents or a final dot on a month's name", () => {
    expect(parseDate('4 marz 2026', 'd MMMM yyyy', 'de-DE')).toEqual(march)
    expect(parseDate('4 Nov. 2026', 'd MMM yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('4 nov 2026', { dateStyle: 'medium' }, 'es-ES')).toEqual(date)
  })

  it('can leave out a word between the fields', () => {
    expect(parseDate('4 noviembre 2026', { dateStyle: 'long' }, 'es-ES')).toEqual(date)
    expect(parseDate('4 de noviembre de 2026', { dateStyle: 'long' }, 'es-ES')).toEqual(date)
    expect(parseDate('4 нояб. 2026', { dateStyle: 'medium' }, 'ru-RU')).toEqual(date)
  })

  it('can leave out the day of the week, however it is written', () => {
    expect(parseDate('4 November 2026', 'EEEE d MMMM yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('Mon 4 November 2026', 'EEEE d MMMM yyyy', 'en-GB')).toEqual(date)
  })

  it("takes the locale's numerals and Latin ones alike", () => {
    expect(parseDate('٠٤/١١/٢٠٢٦', 'dd/MM/yyyy', 'ar-EG')).toEqual(date)
    expect(parseDate('04/11/2026', 'dd/MM/yyyy', 'ar-EG')).toEqual(date)
    expect(parseDate('۰۱/۰۱/۲۰۰۰', 'dd/MM/yyyy', 'fa-IR')).toEqual(new Date(2000, 0, 1))
  })

  it('takes a year of two digits as the nearest, up to twenty years ahead', () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 4) })
    expect(parseDate('01/01/26', 'dd/MM/yyyy', 'en-GB')?.getFullYear()).toBe(2026)
    expect(parseDate('01/01/46', 'dd/MM/yyyy', 'en-GB')?.getFullYear()).toBe(2046)
    expect(parseDate('01/01/47', 'dd/MM/yyyy', 'en-GB')?.getFullYear()).toBe(1947)
    expect(parseDate('01/01/99', 'dd/MM/yy', 'en-GB')?.getFullYear()).toBe(1999)
  })

  it.each([
    ['not a date'],
    [''],
    ['04/11'],
    ['0411'],
    ['04112026'],
    ['04/11/2026/1'],
    ['31/02/2026'],
    ['29/02/2026'],
    ['00/11/2026'],
    ['32/01/2026'],
    ['04/13/2026'],
    ['04/00/2026'],
  ])('turns down %j', (text) => {
    expect(parseDate(text, 'dd/MM/yyyy', 'en-GB')).toBeNull()
  })

  it('takes the 29th of February in a leap year', () => {
    expect(parseDate('29/02/2028', 'dd/MM/yyyy', 'en-GB')).toEqual(new Date(2028, 1, 29))
  })

  it('reads words a pattern writes in pieces as it does those written in one', () => {
    const pattern = "d 'de' MMMM 'de' yyyy"
    for (const typed of [
      '4 de noviembre de 2026',
      '4 noviembre de 2026',
      '4 noviembre 2026',
      '4  de  noviembre de  2026',
      '4-noviembre-2026',
      '4de noviembre de2026',
      '4/11/2026',
    ]) {
      expect(parseDate(typed, pattern, 'es-ES')).toEqual(date)
    }
    expect(parseDate('4 noviembre 2026', pattern, 'es-ES')).toEqual(
      parseDate('4 noviembre 2026', 'd MMMM yyyy', 'es-ES'),
    )
  })

  it('wants something between two fields that a pattern puts words between, as between any', () => {
    // Read with nothing between them, these were the 1st of January 2001 and the 4th of January 2012.
    for (const pattern of ["d 'de' MMMM 'de' yyyy", "'day' d 'of' MMMM yyyy", "d'.' MM'.' yyyy"]) {
      for (const typed of ['11/1', '11 1', '4112', '4noviembre2026', '4 11']) {
        expect([pattern, typed, parseDate(typed, pattern, 'es-ES')]).toEqual([pattern, typed, null])
      }
    }
  })

  it('takes spaces and dots before a weekday or a month as the gap they are', () => {
    expect(parseDate(' . Wednesday, 4 ... November . 2026', 'EEEE, d MMMM yyyy', 'en-GB')).toEqual(date)
    expect(parseDate('4 .. nov. 2026', { dateStyle: 'medium' }, 'en-GB')).toEqual(date)
    // A weekday with nothing before it to take them still does.
    expect(parseDate('4 Wed 11 2026', 'dEEEE MM yyyy', 'en-GB')).toEqual(date)
  })

  it('soon finds that a long run of spaces and dots is no date', () => {
    // The first took a sixth of a second, and nine seconds at twice the length. Half of the
    // second had not been read after six minutes: every way of sharing a run out between a
    // weekday, a month and the gaps round them was tried in turn.
    const started = performance.now()
    for (const pattern of ["d 'de' MMMM 'de' yyyy", "EEEE',' d 'de' MMMM 'de' yyyy"]) {
      expect(parseDate(`1${' '.repeat(190)}x`, pattern, 'es-ES')).toBeNull()
      expect(
        parseDate(`lunes${' .'.repeat(40)} 1${' .'.repeat(40)}nov${'.'.repeat(20)} x`, pattern, 'es-ES'),
      ).toBeNull()
    }
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it("doesn't try text too long to be a date", () => {
    expect(parseDate(`  4 November 2026${' '.repeat(300)}`, 'd MMMM yyyy', 'en-GB')).toEqual(date)
    expect(parseDate(`4 ${' '.repeat(300)}November 2026`, 'd MMMM yyyy', 'en-GB')).toBeNull()
    const started = performance.now()
    expect(parseDate(`1${' '.repeat(100_000)}x`, "d 'de' MMMM 'de' yyyy", 'es-ES')).toBeNull()
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('turns down a month with no such name', () => {
    expect(parseDate('4 Smarch 2026', 'd MMMM yyyy', 'en-GB')).toBeNull()
  })

  it("can't read a format that leaves out part of a date", () => {
    expect(parseDate('November 2026', 'MMMM yyyy', 'en-GB')).toBeNull()
    expect(parseDate('4 November', 'd MMMM', 'en-GB')).toBeNull()
  })

  it('gives the first moment of the day', () => {
    const day = parseDate('04/11/2026', 'dd/MM/yyyy', 'en-GB')!
    expect([day.getHours(), day.getMinutes(), day.getSeconds(), day.getMilliseconds()]).toEqual([0, 0, 0, 0])
  })
})

describe('formatRange', () => {
  const end = new Date(2026, 10, 8)

  it('writes both days, with the separator between them', () => {
    expect(formatRange({ start: date, end }, 'dd/MM/yyyy', 'en-GB', ' – ')).toBe('04/11/2026 – 08/11/2026')
    expect(formatRange({ start: date, end }, 'd MMM', 'en-GB', ' to ')).toBe('4 Nov to 8 Nov')
  })

  it('writes one day once', () => {
    expect(formatRange({ start: date, end: date }, 'dd/MM/yyyy', 'en-GB', ' – ')).toBe('04/11/2026')
  })
})

describe('parseRange', () => {
  const end = new Date(2026, 10, 8)
  const range = { start: date, end }

  it('reads back all it writes', () => {
    const formats: CalendarDateFormat[] = ['dd/MM/yyyy', 'yyyy-MM-dd', 'd MMM yyyy', { dateStyle: 'medium' }]
    for (const format of formats) {
      for (const locale of ['en-GB', 'en-US', 'de-DE', 'ja-JP', 'ar-EG']) {
        expect(parseRange(formatRange(range, format, locale, ' – '), format, locale, ' – ')).toEqual(range)
      }
    }
  })

  it('takes the separator with or without its spaces, or a spaced hyphen', () => {
    expect(parseRange('04/11/2026–08/11/2026', 'dd/MM/yyyy', 'en-GB', ' – ')).toEqual(range)
    expect(parseRange('04/11/2026 - 08/11/2026', 'dd/MM/yyyy', 'en-GB', ' – ')).toEqual(range)
    expect(parseRange('04/11/2026 to 08/11/2026', 'dd/MM/yyyy', 'en-GB', ' to ')).toEqual(range)
  })

  it("isn't thrown by a format of hyphens", () => {
    expect(parseRange('2026-11-04 - 2026-11-08', 'yyyy-MM-dd', 'en-GB', ' – ')).toEqual(range)
    expect(parseRange('04-11-2026', 'dd-MM-yyyy', 'en-GB', ' – ')).toEqual({ start: date, end: date })
  })

  it('puts two days the right way round', () => {
    expect(parseRange('08/11/2026 – 04/11/2026', 'dd/MM/yyyy', 'en-GB', ' – ')).toEqual(range)
  })

  it('takes one day as a range of that day', () => {
    expect(parseRange('04/11/2026', 'dd/MM/yyyy', 'en-GB', ' – ')).toEqual({ start: date, end: date })
  })

  it('takes a range left half written as the one day it has', () => {
    expect(parseRange('04/11/2026 – ', 'dd/MM/yyyy', 'en-GB', ' – ')).toEqual({ start: date, end: date })
    expect(parseRange(' – 04/11/2026', 'dd/MM/yyyy', 'en-GB', ' – ')).toEqual({ start: date, end: date })
  })

  it.each(['', 'soon', '04/11/2026 – soon', '31/02/2026 – 08/11/2026', '04/11/2026 – 05/11/2026 – 06/11/2026'])(
    'turns down %j',
    (text) => {
      expect(parseRange(text, 'dd/MM/yyyy', 'en-GB', ' – ')).toBeNull()
    },
  )
})
