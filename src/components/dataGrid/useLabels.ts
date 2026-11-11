import { createContext, useContext, useState } from 'react'
import { DEFAULT_LABELS, type DataGridLabels } from './labels'

/** The labels of the grid a part is in, a child grid's being its parent's: English outside one. */
export const GridLabelsContext = createContext<DataGridLabels>(DEFAULT_LABELS)

export function useGridLabels() {
  return useContext(GridLabelsContext)
}

/** Whether two sets of labels hold the same, entry for entry. */
function sameLabels(a: Partial<DataGridLabels> | undefined, b: Partial<DataGridLabels> | undefined) {
  if (a === b) return true
  if (!a || !b) return false
  const keys = Object.keys(b) as (keyof DataGridLabels)[]
  return keys.length === Object.keys(a).length && keys.every((key) => Object.is(a[key], b[key]))
}

/**
 * Every label, those given over the English ones: the same object from render to
 * render while what is given holds the same, so a set of words written inline
 * doesn't draw every row again. One whose entries are functions made anew each
 * render does: make those once, outside the component.
 */
export function useLabels(given: Partial<DataGridLabels> | undefined): DataGridLabels {
  const [kept, setKept] = useState(() => ({ given, labels: { ...DEFAULT_LABELS, ...given } }))
  if (sameLabels(kept.given, given)) return kept.labels
  // Kept for the next render; as React allows, set while rendering for what this render saw.
  const next = { given, labels: { ...DEFAULT_LABELS, ...given } }
  setKept(next)
  return next.labels
}
