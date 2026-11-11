import { useLayoutEffect, useMemo, useState, type RefObject } from 'react'
import { columnWidth, columnWidths, type ColumnWidths } from './columnWidths'
import { held } from './held'
import { fitColumns, shownWidths } from './measureColumns'
import type { GridColumn, Row } from './types'

export interface ColumnSizing {
  /** The width of each column that has one of its own, in px, by property name. */
  widths: ColumnWidths
  /**
   * Makes a column so wide, in px. `anchored`, the columns before it are held
   * at the widths they show, so its edge stays under the pointer dragging it
   * rather than those before it taking up the change.
   */
  resize(key: string, width: number, anchored?: boolean): void
  /** Makes a column as wide as its header and its values need (fitColumns). */
  fit(key: string): void
  /** Fits every column that can be resized, at once. */
  fitAll(): void
}

/**
 * How wide the grid's columns are. A column starts as it asks to be: so many
 * px, fitted to what is in it, or with a share of the grid's width. From then
 * on it is as wide as it was last dragged or fitted from its header, which a
 * new `width` for it doesn't undo.
 *
 * A column that asks to be fitted ('auto') is, once: as soon as the grid is
 * laid out (`laidOut` says when a hidden one comes to be) and has rows to
 * measure, `rows` being every one the filters let through. Until then it
 * shares the width.
 */
export function useColumnWidths(
  table: RefObject<HTMLElement | null>,
  columns: readonly GridColumn[],
  rows: readonly Row[],
  laidOut: boolean,
): ColumnSizing {
  const [sized, setSized] = useState<ColumnWidths>({})
  const widths = useMemo(() => columnWidths(columns, sized), [columns, sized])

  function fit(these: readonly GridColumn[]) {
    const fitted = table.current && fitColumns(table.current, columns, these, rows)
    if (fitted) setSized({ ...sized, ...fitted })
  }

  // Before the first paint, where it can be, so the columns don't jump as they are fitted.
  useLayoutEffect(() => {
    const waiting = columns.filter((column) => column.width === 'auto' && held(sized, column.key) === undefined)
    if (!table.current || !waiting.length || !rows.length) return
    const fitted = fitColumns(table.current, columns, waiting, rows)
    // oxlint-disable-next-line react/set-state-in-effect -- what was measured, which only the page as laid out can say
    if (fitted) setSized((was) => ({ ...fitted, ...was }))
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `laidOut` runs it again as a hidden grid comes to show
  }, [table, columns, rows, sized, laidOut])

  return {
    widths,
    resize(key, width, anchored = false) {
      // The columns before it that share the width, each held as wide as it shows.
      const before: [string, number][] = []
      if (anchored && table.current) {
        const shown = shownWidths(table.current)
        for (const [i, column] of columns.entries()) {
          if (column.key === key) break
          if (held(widths, column.key) === undefined && shown[i]) before.push([column.key, columnWidth(shown[i])])
        }
      }
      setSized({ ...sized, ...Object.fromEntries(before), [key]: columnWidth(width) })
    },
    fit: (key) => fit(columns.filter((column) => column.key === key)),
    fitAll: () => fit(columns.filter((column) => column.resizable)),
  }
}
