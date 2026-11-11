import { currencyFormat, parseNumber, separatorsOf, plainNumber } from './locale'
import { formatNumber } from './numberMask'
import { holding, plainText, textOf } from './text'
import type { GridColumn, GridFilter } from './types'

// What number and money columns do with their values: write them, and find them by a filter.

/** A stored value as a number: a JSON number, or text holding one as JSON writes it; null for anything else. */
export function numberValue(value: unknown) {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

/** A number as its column writes it: through its mask, or else its locale's way, every decimal and no grouping. */
export function formatNumberValue(value: unknown, column: GridColumn) {
  const n = numberValue(value)
  if (n === null) return plainText(value)
  return column.mask ? formatNumber(n, column.mask, separatorsOf(column.locale)) : plainNumber(n, column.locale)
}

/** An amount as its column writes it: through its mask, or else as its locale writes its currency (£1,000.00). */
export function formatMoney(value: unknown, column: GridColumn) {
  const n = numberValue(value)
  if (n === null) return plainText(value)
  if (column.mask) return formatNumber(n, column.mask, separatorsOf(column.locale))
  return currencyFormat(column.locale, column.currency).format(n)
}

/** A number typed in the column's locale, with its currency for a money column ('£12'); null for one that isn't. */
export const readNumber = (text: string, column: GridColumn) =>
  parseNumber(text, column.locale, column.currency || undefined)

const COMPARISON = /^(<=|>=|<|>|=)\s*(.+)$/

/**
 * A number filter's test: `>10`, `<=2.5` or `=0` compare, the number typed as
 * the column's locale writes them (`>1.000,5` in de-DE, and with a money
 * column's currency, `>£100`); anything else is looked for in the number as it
 * is stored or as `format` writes it, so 1,234 finds 1234.5. The filter is read
 * once, for every row it is put to.
 */
export const numberMatcher =
  (format: (value: unknown, column: GridColumn) => string) =>
  (filter: GridFilter, column: GridColumn): ((value: unknown) => boolean) => {
    const text = String(filter).trim()
    const found = COMPARISON.exec(text)
    const operand = found && readNumber(found[2], column)
    if (!found || operand === null) {
      const holds = holding(text)
      return (value) => holds(textOf(value)) || holds(format(value, column))
    }
    const operator = found[1]
    return (value) => {
      const a = numberValue(value)
      return a !== null && compare(a, operator, operand)
    }
  }

function compare(a: number, operator: string, b: number) {
  switch (operator) {
    case '<':
      return a < b
    case '<=':
      return a <= b
    case '>':
      return a > b
    case '>=':
      return a >= b
    default:
      return a === b
  }
}
