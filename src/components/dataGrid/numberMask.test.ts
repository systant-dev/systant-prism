import { describe, expect, it } from 'vitest'
import { formatNumber } from './numberMask'

describe('formatNumber', () => {
  it.each([
    [1234.5, '#,###.00', '1,234.50'],
    [1234567.891, '#,##0.00', '1,234,567.89'],
    [0.5, '#,###.00', '.50'],
    [0.5, '#,##0.00', '0.50'],
    [0, '#,###', ''],
    [0, '#,##0', '0'],
    [7, '000', '007'],
    [1234.5, '0', '1235'],
    [2.5, '0.0#', '2.5'],
    [2.567, '0.0#', '2.57'],
    [2, '0.0#', '2.0'],
    [2, '0.##', '2'],
    [1.005, '0.00', '1.01'],
    [1234.5, '£#,##0.00', '£1,234.50'],
    [2.5, '0.0 kg', '2.5 kg'],
    [0.256, '0.0%', '25.6%'],
    [-1234.5, '£#,##0.00', '-£1,234.50'],
    [-0.001, '0.00', '0.00'],
    [1e-7, '0.000', '0.000'],
    [12, 'No. 0', 'No. 12'],
  ])('writes %d as %j says: %j', (n, mask, text) => {
    expect(formatNumber(n, mask)).toBe(text)
  })

  it('writes the number as it is with a mask of no digits, or a value that is no number', () => {
    expect(formatNumber(12.5, 'units')).toBe('12.5')
    expect(formatNumber(Number.NaN, '0.00')).toBe('NaN')
  })
})

describe('formatNumber with a locale', () => {
  it("writes a mask's , and . as the separators it is given", () => {
    expect(formatNumber(1234.5, '#,##0.00', { group: '.', decimal: ',' })).toBe('1.234,50')
    expect(formatNumber(1234567, '#,##0', { group: '\u202f', decimal: ',' })).toBe('1\u202f234\u202f567')
    expect(formatNumber(0.256, '0.0%', { group: '.', decimal: ',' })).toBe('25,6%')
  })
})
