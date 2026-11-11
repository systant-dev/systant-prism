import { once } from '../../shared'
import type { Separators } from './locale'

/** A number mask, read: what goes round the digits, and how they are written. */
interface NumberMask {
  prefix: string
  suffix: string
  /** The least digits before the point (its 0s), whether they are grouped in thousands, and the least and most after it. */
  minInt: number
  group: boolean
  minFrac: number
  maxFrac: number
  /** Whether the number is shown as a percentage, a hundred times over. */
  percent: boolean
}

const PLACEHOLDERS = '0#,.'

/** A mask as read, or null where it has no digits in it to fill. */
function readMask(mask: string): NumberMask | null {
  const first = mask.search(/[0#]/)
  if (first < 0) return null
  let last = first
  for (let i = first; i < mask.length; i++) if (mask[i] === '0' || mask[i] === '#') last = i
  // The run of placeholders round the digits, taking in a point or comma at either end ('.00', '#,##0.').
  let start = first
  while (start > 0 && PLACEHOLDERS.includes(mask[start - 1])) start--
  let end = last + 1
  while (end < mask.length && PLACEHOLDERS.includes(mask[end])) end++

  const body = mask.slice(start, end)
  const point = body.indexOf('.')
  const int = point < 0 ? body : body.slice(0, point)
  const frac = point < 0 ? '' : body.slice(point + 1).replaceAll(/[,.]/g, '')
  const prefix = mask.slice(0, start)
  const suffix = mask.slice(end)
  return {
    prefix,
    suffix,
    minInt: int.replaceAll(/[^0]/g, '').length,
    group: int.includes(','),
    minFrac: frac.replaceAll(/[^0]/g, '').length,
    maxFrac: frac.length,
    percent: (prefix + suffix).includes('%'),
  }
}

// Masks are few and the rows many, so each is read once.
const masks = new Map<string, NumberMask | null>()

function maskOf(mask: string) {
  return once(masks, mask, () => readMask(mask))
}

/** `n` rounded half away from zero to `places`, as the digits toFixed writes, without its float error (1.005 → 1.01). */
function fixed(n: number, places: number) {
  const shifted = Number(`${n}e${places}`)
  // A number already written with an exponent (1e-7) can't be shifted that way; toFixed does well enough.
  return Number.isFinite(shifted) ? (Math.round(shifted) / 10 ** places).toFixed(places) : n.toFixed(places)
}

/**
 * A number written as an Excel-style mask says: `0` a digit always written, `#`
 * a digit written only where it counts, `,` in the whole part grouping it in
 * thousands, `.` the decimal point, and `%` anywhere outside the digits a
 * percentage, the number a hundred times over. Anything else before or after
 * the digits is written as it stands, so `£#,##0.00` gives £1,234.50 and
 * `0.0 kg` 2.5 kg. As in Excel, a whole part of only `#`s writes nothing for
 * zero: `#,###.00` gives .50 for a half, where `#,##0.00` gives 0.50. A mask
 * with no `0` or `#` writes the number as it is.
 *
 * As in Excel, `,` and `.` in the mask stand for the grouping and decimal
 * separators, written as `separators` has them: `#,##0.00` gives 1,234.50 with
 * en-GB's and 1.234,50 with de-DE's.
 */
export function formatNumber(
  n: number,
  mask: string,
  { group, decimal }: Separators = { group: ',', decimal: '.' },
): string {
  const read = maskOf(mask)
  if (!read || !Number.isFinite(n)) return String(n)
  const { prefix, suffix, minInt, group: grouped, minFrac, maxFrac, percent } = read

  const value = percent ? n * 100 : n
  const digits = fixed(Math.abs(value), maxFrac)
  let [int, frac = ''] = digits.split('.')
  while (frac.length > minFrac && frac.endsWith('0')) frac = frac.slice(0, -1)
  if (int === '0' && minInt === 0) int = ''
  int = int.padStart(minInt, '0')
  if (grouped) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, group)

  // Not "-0.00" for a small negative number rounded away.
  const sign = value < 0 && Number(digits) !== 0 ? '-' : ''
  return `${sign}${prefix}${int}${frac ? `${decimal}${frac}` : ''}${suffix}`
}
