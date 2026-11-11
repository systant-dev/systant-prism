import { fold } from '../../shared'
import type { GridFilter } from './types'

/** A value as text, '' for none: what an editor starts with, and a choice is known by. */
export const textOf = (value: unknown) => (value == null ? '' : String(value))

/** Any value as plain text: lists joined, objects as JSON. */
export function plainText(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(plainText).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Text typed in an editor, empty as null. */
export function typed(draft: unknown) {
  const text = String(draft ?? '')
  return text.trim() ? text : null
}

/**
 * A test of whether text holds the filter's, whatever its case and accents:
 * the filter folded once, for every row it is put to.
 */
export function holding(filter: GridFilter) {
  const folded = fold(String(filter).trim())
  return (shown: string) => fold(shown).includes(folded)
}
