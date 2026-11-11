import { held } from './held'
import { numberValue } from './numbers'
import type { DataGridSummary, Row } from './types'

/** How many decimal places a number is written with: 2 for 12.25, 0 for 3. */
function decimals(n: number) {
  const [digits, exponent] = String(n).split('e')
  const places = (digits.split('.')[1]?.length ?? 0) - Number(exponent ?? 0)
  return Math.max(places, 0)
}

/** The most places a summary is given, past which a float's noise begins. */
const MAX_PLACES = 10

/**
 * A summary of the numbers in column `key` of `rows`, rounded to as many decimal
 * places as the most precise of them (an average to two more), so adding up
 * 0.1 and 0.2 gives 0.3, not 0.30000000000000004. Empty values and anything
 * that isn't a number are left out; with none left, a total is 0 and the rest
 * are null.
 */
export function summarize(rows: readonly Row[], key: string, summary: DataGridSummary): number | null {
  let count = 0
  let sum = 0
  let min = Infinity
  let max = -Infinity
  let places = 0
  // A loop rather than Math.min(...values): spreading a hundred thousand arguments can overflow the stack.
  for (const row of rows) {
    const n = numberValue(held(row, key))
    if (n === null) continue
    count++
    sum += n
    if (n < min) min = n
    if (n > max) max = n
    places = Math.max(places, decimals(n))
  }
  if (!count) return summary === 'total' ? 0 : null
  const round = (n: number, extra = 0) => Number(n.toFixed(Math.min(places + extra, MAX_PLACES)))
  switch (summary) {
    case 'min':
      return min
    case 'max':
      return max
    case 'average':
      return round(sum / count, 2)
    default:
      return round(sum)
  }
}
