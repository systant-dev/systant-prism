import { describe, expect, it } from 'vitest'
import { KINDS, canEdit, inUse, type ColumnKind } from './columnTypes'
import { dayOf, isDays, isoDay } from './dates'
import { plainText } from './text'
import { readShape } from './columns'
import type { DataGridColumnType, GridColumn, GridFilter } from './types'

/** Whether `value` passes `filter`, by the test the kind makes for it. */
const matches = (kind: ColumnKind, value: unknown, filter: GridFilter, col: GridColumn) =>
  kind.matcher(filter, col)(value)

/** A column of `type`, as readShape makes it, with `options` for a dropdown. */
function column(type: DataGridColumnType, options?: { value: string; label: string }[]): GridColumn {
  return readShape([{ x: null }], { x: { type, options } }).columns[0]
}

describe('plainText', () => {
  it.each([
    [null, ''],
    [42, '42'],
    ['text', 'text'],
    [['a', 1], 'a, 1'],
    [{ city: 'London' }, '{"city":"London"}'],
  ])('writes %j as %j', (value, text) => {
    expect(plainText(value)).toBe(text)
  })
})

describe('text', () => {
  const kind = KINDS.text

  it('finds what is typed anywhere, whatever its case and accents', () => {
    expect(matches(kind, 'Émilie', 'EMI', column('text'))).toBe(true)
    expect(matches(kind, 'Ada', 'x', column('text'))).toBe(false)
  })

  it('edits as text, empty as null', () => {
    expect(kind.toDraft(null, column('text'))).toBe('')
    expect(kind.fromDraft('  ', column('text'))).toBeNull()
    expect(kind.fromDraft(' padded ', column('text'))).toBe(' padded ')
  })
})

describe('number', () => {
  const kind = KINDS.number
  const col = column('number')

  it.each([
    [12, '>10', true],
    [10, '>10', false],
    [10, '>= 10', true],
    [2.5, '<=2.5', true],
    [-3, '<-2', true],
    [0, '=0', true],
    [0, '=1', false],
    [null, '<5', false],
    [123, '2', true],
    [13, '4', false],
  ])('%j passes %j: %j', (value, filter, passes) => {
    expect(matches(kind, value, filter, col)).toBe(passes)
  })

  it('sorts by size, ends its cells, and reads edits back as numbers', () => {
    expect(kind.sortKey('7', col)).toBe(7)
    expect(kind.alignEnd).toBe(true)
    expect(kind.fromDraft(' 12.5 ', col)).toBe(12.5)
    expect(kind.fromDraft('', col)).toBeNull()
  })

  it('turns down text that is not a number, and lets an empty field through', () => {
    expect(kind.check!('12a', col)).toBe('must be a number')
    expect(kind.check!(' -3.5 ', col)).toBeNull()
    expect(kind.check!('', col)).toBeNull()
    // Text without a mask can hold anything.
    expect(KINDS.text.check!('12a', column('text'))).toBeNull()
  })
})

describe('checkbox', () => {
  const kind = KINDS.checkbox
  const col = column('checkbox')

  it('shows and filters by Yes and No, an empty value counting as unticked', () => {
    expect([true, false, null].map((v) => kind.format(v, col))).toEqual(['Yes', 'No', ''])
    expect(kind.filter).toBe('choices')
    expect(matches(kind, true, ['true'], col)).toBe(true)
    expect(matches(kind, null, ['false'], col)).toBe(true)
    expect(matches(kind, false, ['true'], col)).toBe(false)
  })

  it('edits as a toggle', () => {
    expect(kind.toDraft(undefined, col)).toBe(false)
    expect(kind.fromDraft(true, col)).toBe(true)
  })
})

describe('dropdown', () => {
  const kind = KINDS.dropdown
  const col = column('dropdown', [
    { value: 'b', label: 'Beta' },
    { value: 'a', label: 'Alpha' },
  ])

  it("shows and sorts by a choice's label, and the value where it isn't a choice", () => {
    expect(kind.format('b', col)).toBe('Beta')
    expect(kind.sortKey('a', col)).toBe('Alpha')
    expect(kind.format('z', col)).toBe('z')
  })

  it('filters by the choices picked', () => {
    expect(matches(kind, 'a', ['a', 'b'], col)).toBe(true)
    expect(matches(kind, 'a', ['b'], col)).toBe(false)
  })

  it('edits the value itself', () => {
    expect(kind.toDraft(undefined, col)).toBeNull()
    expect(kind.fromDraft(3, col)).toBe(3)
  })
})

describe('date', () => {
  const kind = KINDS.date
  const col = column('date')

  it('reads an ISO date as a local day, and a timestamp as its moment', () => {
    expect(dayOf('2026-11-09')).toEqual(new Date(2026, 10, 9))
    expect(dayOf('2026-11-09T12:00:00Z')).toEqual(new Date('2026-11-09T12:00:00Z'))
    expect(dayOf('soon')).toBeNull()
    expect(dayOf(42)).toBeNull()
  })

  it('reads no day that does not exist, but every one that does, early years included', () => {
    expect(dayOf('2026-02-31')).toBeNull()
    expect(dayOf('2026-13-01')).toBeNull()
    expect(dayOf('2024-02-29')?.getDate()).toBe(29)
    const early = dayOf('0099-03-01')!
    expect([early.getFullYear(), early.getMonth(), early.getDate()]).toEqual([99, 2, 1])
  })

  it('shows the day as the reader writes one, sorts by time, and is filtered as it shows', () => {
    const shown = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(1906, 11, 9))
    expect(kind.format('1906-12-09', col)).toBe(shown)
    expect(kind.format('not a date', col)).toBe('not a date')
    expect(kind.sortKey('1906-12-09', col)).toBe(new Date(1906, 11, 9).getTime())
    expect(matches(kind, '1906-12-09', '1906', col)).toBe(true)
  })

  it('edits a day, stored back as an ISO date', () => {
    expect(kind.toDraft('1906-12-09', col)).toEqual(new Date(1906, 11, 9))
    expect(kind.fromDraft(new Date(2026, 0, 5), col)).toBe('2026-01-05')
    expect(kind.fromDraft(null, col)).toBeNull()
    expect(isoDay(new Date(999, 8, 30))).toBe('0999-09-30')
  })
})

describe('inUse and canEdit', () => {
  it('counts text with something in it, and any choice picked', () => {
    expect([undefined, '', '  ', 'a', [], ['a']].map(inUse)).toEqual([false, false, false, true, false, true])
  })

  it('edits every type but JSON, and never the key', () => {
    expect(canEdit(column('dropdown'), 'id')).toBe(true)
    expect(canEdit(column('json'), 'id')).toBe(false)
    expect(canEdit(column('text'), 'x')).toBe(false)
  })
})

describe('masks', () => {
  /** A column of `type` with `mask`, as readShape makes it. */
  const masked = (type: DataGridColumnType, mask: string) => readShape([{ x: null }], { x: { type, mask } }).columns[0]

  it('writes numbers, and numbers written as text, as the mask says, and anything else as it is', () => {
    const col = masked('number', '£#,##0.00')
    expect(KINDS.number.format(1234.5, col)).toBe('£1,234.50')
    expect(KINDS.number.format('1234.5', col)).toBe('£1,234.50')
    expect(KINDS.number.format('n/a', col)).toBe('n/a')
    expect(KINDS.number.format(null, col)).toBe('')
  })

  it('finds a number by what the mask writes as well as by the number, and compares the number', () => {
    const col = masked('number', '#,##0.00')
    expect(matches(KINDS.number, 1234.5, '1,234', col)).toBe(true)
    expect(matches(KINDS.number, 1234.5, '1234.5', col)).toBe(true)
    expect(matches(KINDS.number, 1234.5, '>1000', col)).toBe(true)
  })

  it('writes dates as the pattern says, and finds them by it', () => {
    const col = masked('date', 'dd/MM/yyyy')
    expect(KINDS.date.format('2026-11-09', col)).toBe('09/11/2026')
    expect(matches(KINDS.date, '2026-11-09', '09/11', col)).toBe(true)
    expect(KINDS.date.format('soon', col)).toBe('soon')
  })
})

describe('date range filters', () => {
  const col = readShape([{ x: null }], { x: { type: 'date' } }).columns[0]
  const days = { start: new Date(2026, 10, 2), end: new Date(2026, 10, 6) }

  it('takes a run of days, and finds the dates on them, both ends included', () => {
    expect(KINDS.date.filter).toBe('days')
    expect(
      ['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-07'].map((d) =>
        matches(KINDS.date, d, days, col),
      ),
    ).toEqual([false, true, true, true, false])
  })

  it('finds a moment late on the last day, and nothing that is not a date', () => {
    const late = new Date(2026, 10, 6, 23, 59).toISOString()
    expect(matches(KINDS.date, late, days, col)).toBe(true)
    expect(matches(KINDS.date, null, days, col)).toBe(false)
    expect(matches(KINDS.date, 'soon', days, col)).toBe(false)
  })

  it('counts a run of days as a filter in use', () => {
    expect(inUse(days)).toBe(true)
    expect(isDays(days)).toBe(true)
    expect(isDays('2026')).toBe(false)
    expect(isDays(['a'])).toBe(false)
  })
})

describe('locales and money', () => {
  /** A column of `type` written as `locale`, as readShape makes it. */
  const localed = (type: DataGridColumnType, locale: string, spec: { mask?: string; currency?: string } = {}) =>
    readShape([{ x: null }], { x: { type, ...spec } }, { locale }).columns[0]
  const intl = (locale: string, options: Intl.NumberFormatOptions, n: number) =>
    new Intl.NumberFormat(locale, options).format(n)

  it('writes money in its currency as the locale writes it', () => {
    expect(KINDS.money.format(1000, localed('money', 'en-GB', { currency: 'GBP' }))).toBe('£1,000.00')
    expect(KINDS.money.format(1000, localed('money', 'fr-FR', { currency: 'EUR' }))).toBe(
      intl('fr-FR', { style: 'currency', currency: 'EUR' }, 1000),
    )
    expect(KINDS.money.format(1000, localed('money', 'fr-FR', { currency: 'EUR' }))).toMatch(/^1\s000,00\s€$/)
    expect(KINDS.money.format(1000, localed('money', 'en-GB', { currency: 'EUR' }))).toBe('€1,000.00')
    expect(KINDS.money.format('n/a', localed('money', 'en-GB', { currency: 'GBP' }))).toBe('n/a')
  })

  it("writes money through a mask, with the locale's separators, where the column has one", () => {
    expect(KINDS.money.format(1234.5, localed('money', 'de-DE', { mask: '#,##0.00 €', currency: 'EUR' }))).toBe(
      '1.234,50 €',
    )
  })

  it("edits money as the currency's decimals, and takes it back typed the locale's way, symbol and all", () => {
    const col = localed('money', 'de-DE', { currency: 'EUR' })
    expect(KINDS.money.toDraft(1234.5, col)).toBe('1234,50')
    expect(KINDS.money.fromDraft('1.234,50 €', col)).toBe(1234.5)
    expect(KINDS.money.check!('zwölf', col)).toBe('must be an amount')
    expect(KINDS.money.toDraft(1234, localed('money', 'ja-JP', { currency: 'JPY' }))).toBe('1234')
  })

  it("makes a money column with no currency, its own or the grid's, a number column, rather than guess one", () => {
    expect(localed('money', 'en-GB')).toMatchObject({ type: 'number', currency: '' })
    const granted = readShape([{ x: 1 }], { x: { type: 'money' } }, { locale: 'en-GB', currency: 'USD' }).columns[0]
    expect(granted).toMatchObject({ type: 'money', currency: 'USD' })
  })

  it("writes and reads plain numbers the locale's way, without grouping", () => {
    const col = localed('number', 'de-DE')
    expect(KINDS.number.format(1234.5, col)).toBe('1234,5')
    expect(KINDS.number.toDraft(1234.5, col)).toBe('1234,5')
    expect(KINDS.number.fromDraft('1.234,5', col)).toBe(1234.5)
    expect(KINDS.number.check!('1234,5', col)).toBeNull()
    expect(KINDS.number.format(1234.5, localed('number', 'de-DE', { mask: '#,##0.00' }))).toBe('1.234,50')
  })

  it("compares by a number typed the locale's way, a money column's with its currency", () => {
    expect(matches(KINDS.number, 1500, '>1.000,5', localed('number', 'de-DE'))).toBe(true)
    expect(matches(KINDS.number, 999, '>1.000,5', localed('number', 'de-DE'))).toBe(false)
    expect(matches(KINDS.money, 150, '>£100', localed('money', 'en-GB', { currency: 'GBP' }))).toBe(true)
    expect(matches(KINDS.money, 1000, '1,000', localed('money', 'en-GB', { currency: 'GBP' }))).toBe(true)
  })

  it.each(['ar-EG', 'fa-IR', 'bn-BD', 'mr-IN'])(
    'takes back what its own editor holds in %s, which writes digits of its own',
    (locale) => {
      const col = localed('number', locale)
      const draft = KINDS.number.toDraft(1234.5, col)
      expect(draft).not.toBe('1234.5')
      expect(KINDS.number.check!(draft, col)).toBeNull()
      expect(KINDS.number.fromDraft(draft, col)).toBe(1234.5)

      const amounts = localed('money', locale, { currency: 'USD' })
      const amount = KINDS.money.toDraft(1234.5, amounts)
      expect(KINDS.money.check!(amount, amounts)).toBeNull()
      expect(KINDS.money.fromDraft(amount, amounts)).toBe(1234.5)
    },
  )

  it("compares by a number typed in the locale's own digits", () => {
    expect(matches(KINDS.number, 1500, '>١٠٠٠', localed('number', 'ar-EG'))).toBe(true)
    expect(matches(KINDS.number, 999, '>١٠٠٠', localed('number', 'ar-EG'))).toBe(false)
    expect(matches(KINDS.number, 999, '<=1000', localed('number', 'ar-EG'))).toBe(true)
  })

  it("writes dates as the column's locale does, masked or not", () => {
    const day = '2026-11-09'
    expect(KINDS.date.format(day, localed('date', 'fr-FR'))).toBe(
      new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(2026, 10, 9)),
    )
    expect(KINDS.date.format(day, localed('date', 'fr-FR', { mask: 'd MMMM yyyy' }))).toBe('9 novembre 2026')
  })
})
