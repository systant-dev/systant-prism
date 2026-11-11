// What a locale does with numbers, money and text: its separators and digits,
// reading a number typed its way, and the order it puts text in. Intl's
// formatters are slow to make and the cells many, so each is made once.

import { once } from '../../shared'

const numberFormats = new Map<string, Intl.NumberFormat>()

/** How `locale` writes a number, grouped: 12,345 in en-GB. */
export function numberFormat(locale: string) {
  return once(numberFormats, locale, () => new Intl.NumberFormat(locale))
}

const currencyFormats = new Map<string, Intl.NumberFormat>()

/** How `locale` writes an amount of `currency`: £1,000.00 for GBP in en-GB. */
export function currencyFormat(locale: string, currency: string) {
  return once(
    currencyFormats,
    `${locale}|${currency}`,
    () => new Intl.NumberFormat(locale, { style: 'currency', currency }),
  )
}

const plainFormats = new Map<string, Intl.NumberFormat>()

export interface Separators {
  /** Between groups of thousands: ',' in en-GB, '.' in de-DE, a narrow space in fr-FR. */
  group: string
  /** Before the decimals: '.' in en-GB, ',' in de-DE and fr-FR. */
  decimal: string
}

const separators = new Map<string, Separators>()

/** The separators `locale` writes numbers with, found once. */
export function separatorsOf(locale: string): Separators {
  return once(separators, locale, () => {
    const parts = numberFormat(locale).formatToParts(1234567.5)
    return {
      group: parts.find((part) => part.type === 'group')?.value ?? ',',
      decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    }
  })
}

/** A number as `locale` writes it, with every decimal it has but no grouping: 1234,5 in de-DE, for an editor. */
export function plainNumber(n: number, locale: string, decimals?: number) {
  const format = once(
    plainFormats,
    `${locale}|${decimals ?? ''}`,
    () =>
      new Intl.NumberFormat(locale, {
        useGrouping: false,
        maximumFractionDigits: decimals ?? 20,
        minimumFractionDigits: decimals ?? 0,
      }),
  )
  return format.format(n)
}

/** Characters that may stand for a minus: a hyphen, or the minus sign some locales write (Swedish, Norwegian). */
const MINUS = /[−‒–]/g

/**
 * Marks that show nothing: those that keep a number in order in text running
 * right to left, which Arabic and Persian write round a minus and a currency.
 */
const INVISIBLE = /\p{Cf}/gu

const digits = new Map<string, readonly string[]>()

/** The ten digits `locale` writes numbers with, 0 first: 0 to 9 for most, ٠ to ٩ in ar-EG. */
function digitsOf(locale: string) {
  return once(digits, locale, () => Array.from({ length: 10 }, (_, digit) => numberFormat(locale).format(digit)))
}

/**
 * `text` with the locale's own digits as the Latin ones the rest is read by:
 * '١٢٣' as '123' in ar-EG. Latin digits are left as they are, so either will
 * do, and so are the digits of any other script, which the locale doesn't write.
 */
export function latinDigits(text: string, locale: string) {
  const own = digitsOf(locale)
  if (own[0] === '0') return text
  return text.replace(/\p{Nd}/gu, (digit) => {
    const value = own.indexOf(digit)
    return value < 0 ? digit : String(value)
  })
}

/**
 * A number typed as `locale` writes them, or null where the text isn't one:
 * '1.234,5' or '1234,5' in de-DE, '1 234,5' in fr-FR, '1,234.5' in en-GB, in
 * the locale's own digits or Latin ones ('١٢٣٤٫٥' or '1234٫5' in ar-EG). With
 * `currency`, its symbol or code may be typed too ('£12', '12 €', 'EUR 12').
 * Empty text is null too.
 */
export function parseNumber(text: string, locale: string, currency?: string): number | null {
  const written = separatorsOf(locale)
  let s = latinDigits(text, locale).replace(INVISIBLE, '')
  if (currency) {
    s = s.split(currency).join('')
    const symbol = currencySymbol(locale, currency).replace(INVISIBLE, '')
    if (symbol) s = s.split(symbol).join('')
  }
  // '- £12', once its currency is gone, is -12.
  s = s.replace(MINUS, '-').trim().replace(/^-\s+/, '-')
  if (!numberPattern(written).test(s)) return null
  const [whole, decimals] = s.split(written.decimal)
  return Number(`${whole.replace(/[^\d-]/g, '')}${decimals === undefined ? '' : `.${decimals}`}`)
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const patterns = new Map<string, RegExp>()

/**
 * A number as `separators` write it: a minus maybe, then digits, grouped or
 * not, and decimals. Groups must be whole, the last of three digits and any
 * before it of two or three (India's 12,34,567), so a separator in the wrong
 * place is no number: 1.5 in de-DE or 1,5 in en-GB, meant as one and a half,
 * rather than fifteen. A point where French writes a comma is no number either.
 * Any space groups too, as a typed space stands for French's narrow one.
 */
function numberPattern({ group, decimal }: Separators) {
  return once(patterns, group + decimal, () => {
    const g = `(?:${escapeRegExp(group)}|\\s)`
    const d = escapeRegExp(decimal)
    return new RegExp(`^-?(?:(?:\\d{1,3}(?:${g}\\d{2,3})*${g}\\d{3}|\\d+)(?:${d}\\d*)?|${d}\\d+)$`)
  })
}

/** The symbol `locale` writes `currency` with: £ for GBP in en-GB. */
function currencySymbol(locale: string, currency: string) {
  return (
    currencyFormat(locale, currency)
      .formatToParts(1)
      .find((part) => part.type === 'currency')?.value ?? ''
  )
}

const collators = new Map<string, Intl.Collator>()

/**
 * How `locale` puts text in order, the numbers in it by size ("item 2" before
 * "item 10"): ä after z in sv-SE, where en-GB has it beside a. With `loose`,
 * text that differs only by its case or accents counts as the same.
 */
export function collatorOf(locale: string, loose = false) {
  return once(
    collators,
    `${locale}|${loose}`,
    () => new Intl.Collator(locale, { numeric: true, sensitivity: loose ? 'base' : 'variant' }),
  )
}

/** How many decimals `currency` is written with: 2 for pounds and euros, 0 for yen. */
export function currencyDecimals(locale: string, currency: string) {
  return currencyFormat(locale, currency).resolvedOptions().maximumFractionDigits ?? 2
}
