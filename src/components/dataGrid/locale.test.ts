import { describe, expect, it } from 'vitest'
import {
  collatorOf,
  currencyDecimals,
  currencyFormat,
  latinDigits,
  numberFormat,
  parseNumber,
  plainNumber,
  separatorsOf,
} from './locale'

/** French groups thousands with a narrow no-break space. */
const NARROW = '\u202f'

describe('separatorsOf', () => {
  it('gives the separators each locale writes numbers with', () => {
    expect(separatorsOf('en-GB')).toEqual({ group: ',', decimal: '.' })
    expect(separatorsOf('de-DE')).toEqual({ group: '.', decimal: ',' })
    expect(separatorsOf('fr-FR')).toEqual({ group: NARROW, decimal: ',' })
  })
})

describe('plainNumber', () => {
  it("writes every decimal with the locale's separator and no grouping, or as many as asked", () => {
    expect(plainNumber(1234.5, 'en-GB')).toBe('1234.5')
    expect(plainNumber(1234.5, 'de-DE')).toBe('1234,5')
    expect(plainNumber(1234.5, 'fr-FR', 2)).toBe('1234,50')
    expect(plainNumber(0.1 + 0.2, 'en-GB')).toBe('0.30000000000000004')
  })
})

describe('parseNumber', () => {
  it.each([
    ['1,234.5', 'en-GB', 1234.5],
    ['1234.5', 'en-GB', 1234.5],
    ['1.234,5', 'de-DE', 1234.5],
    ['1234,5', 'de-DE', 1234.5],
    [`1${NARROW}234,5`, 'fr-FR', 1234.5],
    ['1 234,5', 'fr-FR', 1234.5],
    ['-12', 'en-GB', -12],
    ['\u221212,5', 'sv-SE', -12.5],
    ['.5', 'en-GB', 0.5],
    ['1.', 'en-GB', 1],
    ['1,234,567', 'en-GB', 1234567],
    ['12,34,567.5', 'en-IN', 1234567.5],
    ['1 234', 'en-GB', 1234],
    ['  -1.234,5  ', 'de-DE', -1234.5],
  ])('reads %j in %s as %d', (text, locale, n) => {
    expect(parseNumber(text, locale)).toBe(n)
  })

  it('takes a currency typed with the amount, by symbol or code', () => {
    expect(parseNumber('£1,000.50', 'en-GB', 'GBP')).toBe(1000.5)
    expect(parseNumber('1.000,50 €', 'de-DE', 'EUR')).toBe(1000.5)
    expect(parseNumber('EUR 12', 'fr-FR', 'EUR')).toBe(12)
    expect(parseNumber('- £12', 'en-GB', 'GBP')).toBe(-12)
  })

  it.each(['ar-EG', 'ar-SA', 'fa-IR', 'bn-BD', 'mr-IN', 'hi-IN', 'de-CH'])(
    'reads back what %s writes, in digits and separators of its own or not',
    (locale) => {
      expect(parseNumber(plainNumber(1234.5, locale), locale)).toBe(1234.5)
      expect(parseNumber(plainNumber(-0.25, locale), locale)).toBe(-0.25)
      expect(parseNumber(numberFormat(locale).format(1234567.5), locale)).toBe(1234567.5)
    },
  )

  it("reads a locale's own digits, Latin ones, and the two together", () => {
    expect(parseNumber('١٢٣٤٫٥', 'ar-EG')).toBe(1234.5)
    expect(parseNumber('1234٫5', 'ar-EG')).toBe(1234.5)
    expect(parseNumber('١٬234٫٥', 'ar-EG')).toBe(1234.5)
    expect(parseNumber('۱۲۳۴٫۵', 'fa-IR')).toBe(1234.5)
    expect(parseNumber('১২৩৪.৫', 'bn-BD')).toBe(1234.5)
    expect(parseNumber('1234.5', 'bn-BD')).toBe(1234.5)
  })

  it('reads no digits a locale does not write', () => {
    expect(parseNumber('১২', 'en-GB')).toBeNull()
    // Arabic's digits, which Persian has its own forms of.
    expect(parseNumber('١٢', 'fa-IR')).toBeNull()
  })

  it('reads an amount back as a locale that runs right to left writes it, marks and all', () => {
    expect(parseNumber(currencyFormat('ar-EG', 'EGP').format(-1234.5), 'ar-EG', 'EGP')).toBe(-1234.5)
    expect(parseNumber(currencyFormat('fa-IR', 'IRR').format(-1234), 'fa-IR', 'IRR')).toBe(-1234)
    expect(parseNumber(currencyFormat('he-IL', 'ILS').format(-1234.5), 'he-IL', 'ILS')).toBe(-1234.5)
  })

  it('reads nothing that is not a number in the locale, nor nothing at all', () => {
    expect(parseNumber('12a', 'en-GB')).toBeNull()
    expect(parseNumber('', 'en-GB')).toBeNull()
    expect(parseNumber('   ', 'en-GB')).toBeNull()
    // A point where French writes a comma.
    expect(parseNumber('1.5', 'fr-FR')).toBeNull()
    expect(parseNumber('£12', 'en-GB')).toBeNull()
  })

  it('reads no number from a group separator in the wrong place, rather than drop it', () => {
    // Meant as one and a half, which would otherwise be fifteen.
    expect(parseNumber('1.5', 'de-DE')).toBeNull()
    expect(parseNumber('1,5', 'en-GB')).toBeNull()
    expect(parseNumber('1,23,4', 'en-GB')).toBeNull()
    expect(parseNumber('1,2345', 'en-GB')).toBeNull()
    expect(parseNumber('1.234.5', 'en-GB')).toBeNull()
  })
})

describe('latinDigits', () => {
  it("writes a locale's own digits as Latin ones, and leaves the rest as it is", () => {
    expect(latinDigits('١٢٣ of ٤٥٦', 'ar-EG')).toBe('123 of 456')
    expect(latinDigits('12 ١٢ ১২', 'ar-EG')).toBe('12 12 ১২')
    expect(latinDigits('١٢', 'en-GB')).toBe('١٢')
  })
})

describe('collatorOf', () => {
  const sorted = (locale: string, loose?: boolean) => ['z', 'ä', 'b', 'B'].sort(collatorOf(locale, loose).compare)

  it("puts text in the locale's order", () => {
    expect(sorted('en-GB')).toEqual(['ä', 'b', 'B', 'z'])
    expect(sorted('sv-SE')).toEqual(['b', 'B', 'z', 'ä'])
  })

  it('sorts the numbers in it by size, and loosely takes no notice of case or accents', () => {
    expect(['item 10', 'item 2'].sort(collatorOf('en-GB').compare)).toEqual(['item 2', 'item 10'])
    expect(collatorOf('en-GB').compare('b', 'B')).not.toBe(0)
    expect(collatorOf('en-GB', true).compare('b', 'B')).toBe(0)
    expect(collatorOf('en-GB', true).compare('e', 'é')).toBe(0)
  })

  it('is made once for a locale', () => {
    expect(collatorOf('sv-SE')).toBe(collatorOf('sv-SE'))
    expect(collatorOf('sv-SE', true)).not.toBe(collatorOf('sv-SE'))
  })
})

describe('currencies', () => {
  it('says how many decimals a currency is written with', () => {
    expect(currencyDecimals('en-GB', 'GBP')).toBe(2)
    expect(currencyDecimals('ja-JP', 'JPY')).toBe(0)
  })
})
