import type { FocusEvent } from 'react'
import { cx } from '../../shared'
import { CellFilter } from './cells'
import { ColumnResizer } from './ColumnResizer'
import { kindOf } from './columnTypes'
import type { ColumnWidths } from './columnWidths'
import { held } from './held'
import { ClearFilter, IconButton, SortArrow } from './icons'
import { RowFrame } from './RowFrame'
import type { GridColumn, GridFilter, GridFilters, GridSort } from './types'
import { useGridLabels } from './useLabels'

export interface GridHeaderProps {
  columns: readonly GridColumn[]
  sort: GridSort | null
  filters: GridFilters
  /** The width of each column that has one of its own, in px. */
  widths: ColumnWidths
  /** Whether there is an expander column before the data, and an actions column after it. */
  expander: boolean
  actions: boolean
  /** Whether sorting and filtering wait, as they would move a row being edited out of view. */
  locked: boolean
  onSort(key: string): void
  onFilter(key: string, filter: GridFilter): void
  /** Makes a column so wide, in px, its edge held under a pointer where one drags it; and as wide as what is in it. */
  onResize(key: string, width: number, anchored: boolean): void
  onFit(key: string): void
  /** Clears every filter; left out where no column has one. */
  onClearFilters?(): void
  /** Whether any filter is in use, for there to be something to clear. */
  filtering: boolean
  /** As the focus moves into it: to a filter, maybe, outside the window the columns show through. */
  onFocus(event: FocusEvent<HTMLDivElement>): void
}

// The grid's column headers, each a button that sorts by its column over the
// filter its type takes (cells.tsx), where the column has one, with a handle on
// its far edge to change the column's width by (ColumnResizer.tsx), where it
// can be. It doesn't scroll: its columns move on a track as the body scrolls
// (DataGrid.styles.ts).
// Where any column has a filter, a button at the end, level with them, clears
// them all.
export function GridHeader({
  columns,
  sort,
  filters,
  widths,
  expander,
  actions,
  locked,
  onSort,
  onFilter,
  onResize,
  onFit,
  onClearFilters,
  filtering,
  onFocus,
}: GridHeaderProps) {
  const labels = useGridLabels()
  return (
    <div className="prism-data-grid__head" role="rowgroup" onFocus={onFocus}>
      <RowFrame
        aria-rowindex={1}
        laneRole="columnheader"
        start={expander && { content: <span className="prism-data-grid__hidden">{labels.details}</span> }}
        end={
          (actions || onClearFilters) && {
            content: (
              <>
                {actions && <span className="prism-data-grid__hidden">{labels.actions}</span>}
                {onClearFilters && (
                  <IconButton
                    label={labels.clearFilters}
                    className="prism-data-grid__icon-button prism-data-grid__clear-filters"
                    disabled={!filtering || locked}
                    onClick={onClearFilters}
                  >
                    <ClearFilter />
                  </IconButton>
                )}
              </>
            ),
          }
        }
      >
        {columns.map((column) => {
          const { key, header } = column
          const direction = sort?.key === key ? sort.direction : undefined
          return (
            <div
              key={key}
              className={cx(
                'prism-data-grid__cell',
                'prism-data-grid__header',
                kindOf(column).alignEnd && 'prism-data-grid__cell--end',
              )}
              role="columnheader"
              aria-sort={direction}
            >
              <button
                type="button"
                className={cx('prism-data-grid__sort', direction && `prism-data-grid__sort--${direction}`)}
                disabled={locked}
                onClick={() => onSort(key)}
              >
                <span className="prism-data-grid__header-text">{header}</span>
                <SortArrow />
              </button>
              {column.filterable && (
                <CellFilter
                  column={column}
                  filter={held(filters, key)}
                  disabled={locked}
                  onFilter={(filter) => onFilter(key, filter)}
                />
              )}
              {column.resizable && (
                <ColumnResizer
                  header={header}
                  width={held(widths, key)}
                  onResize={(width, anchored) => onResize(key, width, anchored)}
                  onFit={() => onFit(key)}
                />
              )}
            </div>
          )
        })}
      </RowFrame>
    </div>
  )
}
