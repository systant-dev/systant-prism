import { held } from './held'
import type { GridColumn } from './types'

/** The narrowest a column can be dragged or fitted to, in px: its padding and a few letters between. */
export const NARROWEST = 48

/** The width of each column that has one of its own, in px, by property name; the rest share the grid's width. */
export type ColumnWidths = Readonly<Record<string, number>>

/**
 * A width a column can take: never under the narrowest, and to a hundredth of a
 * px, as one measured off the page comes with a long tail.
 */
export function columnWidth(width: number) {
  return Math.max(NARROWEST, Math.round(width * 100) / 100)
}

/**
 * How wide each column is: as it was last dragged or fitted (`sized`), or else
 * as it asks to be, in px. One that asks for nothing, or to be fitted and
 * hasn't been yet, has none, and shares the width.
 */
export function columnWidths(columns: readonly GridColumn[], sized: ColumnWidths): ColumnWidths {
  // From entries, which a column named __proto__ is one of like any other: set on an
  // object by name, its width would be dropped.
  return Object.fromEntries(
    columns.flatMap(({ key, width }) => {
      const own = held(sized, key) ?? (typeof width === 'number' && Number.isFinite(width) ? width : undefined)
      return own === undefined ? [] : [[key, columnWidth(own)]]
    }),
  )
}

export interface ColumnTracks {
  /** The columns' grid tracks: a width for each that has one, a share of what is left for the rest. */
  cells: string
  /** The sum of the least each can be, to go in a calc(): under it, the grid scrolls sideways. */
  least: string
}

const LEAST = 'var(--prism-data-grid-column-min)'

/**
 * The tracks the columns are laid on (see DataGrid.styles.ts): one with a
 * width is that wide, whatever the grid's; the rest share the width left over,
 * none going under --prism-data-grid-column-min.
 */
export function columnTracks(columns: readonly GridColumn[], widths: ColumnWidths): ColumnTracks {
  let sharing = 0
  let fixed = 0
  const tracks = columns.map(({ key }) => {
    const width = held(widths, key)
    if (width === undefined) {
      sharing++
      return `minmax(${LEAST}, 1fr)`
    }
    fixed += width
    return `${width}px`
  })
  const least = [(sharing > 0 || fixed === 0) && `${sharing} * ${LEAST}`, fixed > 0 && `${columnWidth(fixed)}px`]
  return { cells: tracks.join(' ') || 'none', least: least.filter(Boolean).join(' + ') }
}
