import { inUse, kindOf } from './columnTypes'
import { held } from './held'
import { collatorOf } from './locale'
import type { GridColumn, GridFilters, GridSort, Row } from './types'

/**
 * The rows that pass the filter of every column with one in use, each as its
 * column's type has it. A column whose filter is hidden filters nothing, so a
 * filter left set as it was hidden can't go on hiding rows unseen. Each
 * filter is read once (its text folded, its comparison parsed), not for each row.
 */
export function filterRows(rows: readonly Row[], columns: readonly GridColumn[], filters: GridFilters): readonly Row[] {
  const tests = columns.flatMap((column) => {
    const filter = held(filters, column.key)
    if (!column.filterable || !inUse(filter)) return []
    const passes = kindOf(column).matcher(filter, column)
    return [(row: Row) => passes(held(row, column.key))]
  })
  if (!tests.length) return rows
  return rows.filter((row) => tests.every((passes) => passes(row)))
}

/** Whether a value is empty, which sorts last: none, or text with nothing in it. */
const isEmpty = (value: unknown) => value == null || value === ''

/**
 * The rows in the order `sort` asks for, by what the column's type sorts by:
 * numbers by size and text as people read it ("item 2" before "item 10"), in
 * the order the column's locale has its letters, whatever their case. Empty
 * values go last either way, and equal ones keep their order.
 */
export function sortRows(rows: readonly Row[], columns: readonly GridColumn[], sort: GridSort | null): readonly Row[] {
  const column = sort && columns.find((c) => c.key === sort.key)
  if (!sort || !column) return rows
  const kind = kindOf(column)
  const sign = sort.direction === 'ascending' ? 1 : -1
  const order = collatorOf(column.locale, true)
  return [...rows].sort((x, y) => {
    const a = held(x, column.key)
    const b = held(y, column.key)
    if (isEmpty(a) || isEmpty(b)) return Number(isEmpty(a)) - Number(isEmpty(b))
    const ka = kind.sortKey(a, column)
    const kb = kind.sortKey(b, column)
    return sign * (typeof ka === 'number' && typeof kb === 'number' ? ka - kb : order.compare(String(ka), String(kb)))
  })
}

/** The next sort a press on a column's header gives: ascending, descending, then none. */
export function nextSort(sort: GridSort | null, key: string): GridSort | null {
  if (sort?.key !== key) return { key, direction: 'ascending' }
  return sort.direction === 'ascending' ? { key, direction: 'descending' } : null
}

/** How many pages `total` rows take; one where there is no paging (`pageSize` 0). */
export function pageCount(total: number, pageSize: number) {
  return pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1
}

/** The rows on page `page`, from 0. */
export function pageRows(rows: readonly Row[], page: number, pageSize: number): readonly Row[] {
  return pageSize > 0 ? rows.slice(page * pageSize, (page + 1) * pageSize) : rows
}
