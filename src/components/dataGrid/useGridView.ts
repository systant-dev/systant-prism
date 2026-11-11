import { useMemo, useState } from 'react'
import { clamp } from '../../shared'
import type { GridColumn, GridFilter, GridFilters, GridSort, Row } from './types'
import { inUse } from './columnTypes'
import { held } from './held'
import { filterRows, nextSort, pageCount, pageRows, sortRows } from './view'

export interface GridView {
  /** The rows on the page showing, filtered and sorted. */
  rows: readonly Row[]
  /** Every row that passes the filters, sorted, on every page. */
  all: readonly Row[]
  /** How many rows pass the filters, on every page. */
  total: number
  /** The page showing, from 0, and how many there are. */
  page: number
  pages: number
  /** Where the page's first row is among them all, from 0. */
  firstIndex: number
  sort: GridSort | null
  filters: GridFilters
  toggleSort(key: string): void
  setFilter(key: string, filter: GridFilter): void
  /** Whether any column with a filter showing has one in use. */
  filtering: boolean
  clearFilters(): void
  setPage(page: number): void
}

/**
 * What of `rows` the grid shows: filtered and sorted as their columns' types
 * have it, and cut into pages of `pageSize` (0 for one page of them all). A new
 * filter or sort goes back to the first page, as what was on the page showing
 * has moved.
 */
export function useGridView(rows: readonly Row[], columns: readonly GridColumn[], pageSize: number): GridView {
  const [sort, setSort] = useState<GridSort | null>(null)
  const [filters, setFilters] = useState<GridFilters>({})
  const [page, setPage] = useState(0)

  const shown = useMemo(
    () => sortRows(filterRows(rows, columns, filters), columns, sort),
    [rows, columns, filters, sort],
  )
  const pages = pageCount(shown.length, pageSize)
  // Rows deleted from the last page can leave it empty.
  const current = Math.min(page, pages - 1)
  const pageOfRows = useMemo(() => pageRows(shown, current, pageSize), [shown, current, pageSize])

  return {
    rows: pageOfRows,
    all: shown,
    total: shown.length,
    page: current,
    pages,
    firstIndex: pageSize > 0 ? current * pageSize : 0,
    sort,
    filters,
    toggleSort: (key) => {
      setSort((s) => nextSort(s, key))
      setPage(0)
    },
    setFilter: (key, filter) => {
      setFilters((f) => ({ ...f, [key]: filter }))
      setPage(0)
    },
    // A filter hidden while it was set filters nothing (filterRows), so it doesn't count.
    filtering: columns.some((c) => c.filterable && inUse(held(filters, c.key))),
    clearFilters: () => {
      setFilters({})
      setPage(0)
    },
    setPage: (next) => setPage(clamp(next, 0, pages - 1)),
  }
}
