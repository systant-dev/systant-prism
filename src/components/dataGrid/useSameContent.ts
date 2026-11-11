import { useState } from 'react'

/**
 * `value`, or the one an earlier render gave while it is the same as this one
 * written out as JSON: so a prop of plain data made anew each render (columns
 * written inline) doesn't count as a change, and doesn't set off all that
 * hangs on it again (every row read, filtered and sorted afresh). Only for
 * plain data: functions in it don't count.
 */
export function useSameContent<T>(value: T): T {
  const key = JSON.stringify(value) ?? ''
  const [kept, setKept] = useState({ key, value })
  if (kept.key === key) return kept.value
  // Kept for the next render; as React allows, set while rendering for what this render saw.
  setKept({ key, value })
  return value
}
