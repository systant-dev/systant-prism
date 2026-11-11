import { cx } from '../../shared'
import { kindOf } from './columnTypes'
import { NARROWEST } from './columnWidths'
import { held } from './held'
import type { GridColumn, Row } from './types'

// What the grid measures of its columns on the page: how wide each shows, and
// how wide one must be to show the whole of what is in it.

/** How many of a column's values are measured: its longest, where more than that differ. */
const MOST_MEASURED = 500

/** The track the header's cells lie on, or the summary row's, a child grid's aside. */
const trackOf = (table: HTMLElement, group: 'head' | 'foot') =>
  table.querySelector<HTMLElement>(`:scope > .prism-data-grid__${group} .prism-data-grid__track`)

/** How wide each column shows, in px, in the columns' order: its header's cell, as it is laid out. */
export function shownWidths(table: HTMLElement): number[] {
  const head = trackOf(table, 'head')
  return head ? [...head.children].map((cell) => cell.getBoundingClientRect().width) : []
}

/**
 * The values of a column to measure, as it writes them: every one that differs,
 * or the longest of them where there are many, as the widest is all but surely
 * among those, and a hundred thousand lines would take a while to lay out.
 * Each value is written once, however many rows hold it: writing them is most
 * of the work, and a column of a hundred thousand rows often holds a few
 * hundred values.
 */
function longest(column: GridColumn, rows: readonly Row[]) {
  const { format } = kindOf(column)
  const written = new Map<unknown, string>()
  for (const row of rows) {
    const value = held(row, column.key)
    // On one line, as a cell writes it.
    if (!written.has(value)) written.set(value, format(value, column).replace(/\s+/g, ' '))
  }
  const texts = [...new Set(written.values())]
  if (texts.length <= MOST_MEASURED) return texts
  return texts.sort((a, b) => b.length - a.length).slice(0, MOST_MEASURED)
}

/** Out of sight and out of the layout, as wide as what is in it. */
const PROBE = 'position:absolute;visibility:hidden;pointer-events:none;width:max-content;max-width:none;'

function probe<E extends HTMLElement>(el: E, into: Element, style = '') {
  el.style.cssText = PROBE + style
  into.append(el)
  return el
}

/**
 * How wide each of the columns in `fit` must be, in px, to show the whole of
 * its header, its values in `rows` and its summary: by property name, or null
 * where the grid isn't laid out (hidden, say) and nothing can be measured.
 *
 * Nothing of the styles is known here. Each part is measured by a probe put
 * where the real one lies, a copy of it or a cell holding the column's values
 * a line each, laid out as wide as its content and taken away again before
 * anything is painted: so the font, the padding and a number's digits are
 * whatever the page has them. Rows out of view aren't drawn, so the values are
 * written afresh rather than read off the cells.
 *
 * A column with a filter is never fitted under --prism-data-grid-column-min,
 * which leaves the filter room to be of use; a checkbox's tick fits in any; and
 * none is fitted wider than the window the columns show through, so the whole
 * of it can be seen at once.
 */
export function fitColumns(
  table: HTMLElement,
  columns: readonly GridColumn[],
  fit: readonly GridColumn[],
  rows: readonly Row[],
): Record<string, number> | null {
  const head = trackOf(table, 'head')
  if (!head || !head.getBoundingClientRect().width) return null
  const foot = trackOf(table, 'foot')
  const headers = [...head.children]
  const summaries = foot ? [...foot.children] : []
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K) => table.ownerDocument.createElement(tag)

  // Every probe goes in before any is measured, so the page is laid out once for them all.
  const probes = fit.map((column) => {
    const at = columns.indexOf(column)
    const parts: HTMLElement[] = []

    // The header's text and arrow, without its filter, which is as wide as it is given.
    const header = headers[at]
    const sort = header?.querySelector('.prism-data-grid__sort')
    if (header && sort) {
      const shell = header.cloneNode(false) as HTMLElement
      shell.append(sort.cloneNode(true))
      parts.push(probe(shell, head))
    }

    if (column.type !== 'checkbox') {
      const cell = make('span')
      cell.className = cx('prism-data-grid__cell', kindOf(column).alignEnd && 'prism-data-grid__cell--end')
      cell.textContent = longest(column, rows).join('\n')
      parts.push(probe(cell, head, 'white-space:pre;'))
    }

    const summary = column.summary && summaries[at]
    if (summary && foot) parts.push(probe(summary.cloneNode(true) as HTMLElement, foot))

    if (column.filterable) parts.push(probe(make('div'), head, 'width:var(--prism-data-grid-column-min);'))
    return parts
  })

  const window = head.parentElement?.clientWidth ?? 0
  const most = window > NARROWEST ? window : Infinity
  const widths = fit.map((column, i) => {
    const needed = Math.max(0, ...probes[i].map((part) => part.getBoundingClientRect().width))
    // A whole px up, so a width that falls between two never cuts the last letter short.
    return [column.key, Math.min(most, Math.max(NARROWEST, Math.ceil(needed)))] as const
  })
  for (const part of probes.flat()) part.remove()
  return Object.fromEntries(widths)
}
