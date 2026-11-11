import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { Progress } from '../progress'
import { cssVars, useHandler } from '../../shared'
import { readShape } from './columns'
import { columnTracks } from './columnWidths'
import { GridDetail } from './GridDetail'
import { GridEditor } from './GridEditor'
import { GridFooter } from './GridFooter'
import { GridHeader } from './GridHeader'
import { GridRow } from './GridRow'
import { GridSummary } from './GridSummary'
import { held } from './held'
import { summarize } from './summary'
import type { DataGridColumns, DataGridSource, GridFilter, Row } from './types'
import { useColumnWidths } from './useColumnWidths'
import { useGridRows } from './useGridRows'
import { useGridView } from './useGridView'
import { useGridLabels } from './useLabels'
import { useRowEditing } from './useRowEditing'
import { useScrollWindow } from './useScrollWindow'
import { VirtualRows } from './VirtualRows'

/** What a grid and the grids of its child collections share. */
export interface GridOptions {
  columns?: DataGridColumns
  /** Whether columns have a filter under their header, unless their own `showFilter` says otherwise. */
  showFilter: boolean
  /** Whether number columns show a total in a summary row, unless their own `summary` says otherwise. */
  showSummary: boolean
  /** Whether columns can be resized from their headers, unless their own `resizable` says otherwise. */
  resizable: boolean
  /** The locale numbers, money and dates are written and read as. */
  locale: string
  /** Money columns' currency, unless they say; a money column with neither is a number column. */
  currency?: string
  rowKey: string
  /** Whether a row asks before it is deleted. */
  confirmDelete: boolean
  pageSize: number
  rowHeight: number
  detailHeight: number
  childSource?: (parent: Row, collection: string) => DataGridSource | undefined
}

export interface GridViewProps extends GridOptions {
  data?: readonly Row[]
  source?: DataGridSource
  /** The columns while there are no rows; the `columns` names if left out (see readShape). */
  emptyColumns?: readonly string[]
  'aria-label'?: string
}

/** What the body lists: a new row being added, the rows, and the child collections of those expanded. */
type Item = { kind: 'new' } | { kind: 'row' | 'detail'; row: Row; id: string; index: number }

// A grid of rows without the glass round it, so that it can be a child grid
// inside another as well as the whole of a DataGrid. It ties the parts
// together: the rows (useGridRows), what of them shows (useGridView), the
// columns read from them (readShape) and how wide each is (useColumnWidths), a
// row being edited (useRowEditing), the window the columns scroll in
// (useScrollWindow), and the header, body and footer that draw them. Which
// rows are expanded is its own.
//
// While a row is being edited, sorting, filtering and turning the page wait,
// as each could move it out of view with the rest of the grid waiting on it.
export function GridView({ data, source, emptyColumns, 'aria-label': label, ...options }: GridViewProps) {
  const { rowKey, confirmDelete, pageSize, rowHeight, detailHeight, showFilter, showSummary, resizable } = options
  const { locale, currency } = options
  const labels = useGridLabels()
  const rows = useGridRows(data, source)
  const { columns, children, childColumns } = useMemo(
    () =>
      readShape(rows.rows, options.columns, {
        empty: emptyColumns,
        showFilter,
        showSummary,
        resizable,
        rowKey,
        locale,
        currency,
        labels,
      }),
    [rows.rows, options.columns, emptyColumns, showFilter, showSummary, resizable, rowKey, locale, currency, labels],
  )
  const view = useGridView(rows.rows, columns, pageSize)
  const { table, body, timeline, laidOut, onScroll, reveal, toTop } = useScrollWindow()
  // Fitted to every row the filters let through, not just the page showing, so a column holds its width as the page turns.
  const sizing = useColumnWidths(table, columns, view.all, laidOut)
  const { editing, invalid, edit, setDraft, cancel, save } = useRowEditing(columns, rowKey, rows, toTop)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())

  // Over every row the filters let through, not just the page showing.
  const summaries = useMemo(
    () => new Map(columns.flatMap((c) => (c.summary ? [[c.key, summarize(view.all, c.key, c.summary)] as const] : []))),
    [columns, view.all],
  )
  const summarised = summaries.size > 0

  // A row is known by its key, or where it came in the rows without one, or
  // with a key another row has too: a React key must be one row's alone.
  const ids = useMemo(() => {
    const taken = new Set<string>()
    return new Map(
      rows.rows.map((row, i) => {
        const key = held(row, rowKey)
        const id = key == null || taken.has(String(key)) ? `#${i}` : String(key)
        taken.add(id)
        return [row, id]
      }),
    )
  }, [rows.rows, rowKey])
  // A row being edited that has left the rows (a new source read, say) can't
  // be shown or saved, and would hold the grid waiting on it: its edit goes too.
  // Set while rendering, as React allows for a component's own state.
  if (editing?.row && !ids.has(editing.row)) cancel()
  const adding = editing !== null && !editing.row
  const items = useMemo(() => {
    const list: Item[] = adding ? [{ kind: 'new' }] : []
    view.rows.forEach((row, i) => {
      const id = ids.get(row)!
      const index = view.firstIndex + i
      list.push({ kind: 'row', row, id, index })
      if (expanded.has(id)) list.push({ kind: 'detail', row, id, index })
    })
    return list
  }, [adding, view.rows, view.firstIndex, ids, expanded])

  const heightOf = useCallback(
    (item: Item) => (item.kind === 'detail' ? detailHeight : rowHeight),
    [rowHeight, detailHeight],
  )

  const expander = children.length > 0
  const actions = Boolean(rows.create || rows.update || rows.remove)
  // A grid with filters but no actions has a narrow end lane for the button that clears them.
  const filterable = columns.some((c) => c.filterable)
  const endLane = actions || filterable
  const busy = rows.saving || editing !== null

  // Handlers the rows and footer are given: the same each render, as they are memoised.
  const remove = useHandler((row: Row) => void rows.remove?.(row))
  const goToPage = useHandler((page: number) => {
    view.setPage(page)
    toTop()
  })
  const toggle = useHandler((id: string) =>
    setExpanded((was) => {
      const next = new Set(was)
      if (!next.delete(id)) next.add(id)
      return next
    }),
  )

  function renderItem(item: Item, style: CSSProperties) {
    if (item.kind === 'detail') {
      const span = columns.length + Number(expander) + Number(endLane)
      return (
        <GridDetail
          {...options}
          row={item.row}
          collections={children}
          childColumns={childColumns}
          span={span}
          style={style}
        />
      )
    }
    const row = item.kind === 'row' ? item.row : undefined
    if (editing && editing.row === row) {
      return (
        <GridEditor
          row={row}
          rowKey={rowKey}
          columns={columns}
          rowIndex={item.kind === 'row' ? item.index + 2 : undefined}
          draft={editing.draft}
          invalid={invalid?.key ?? null}
          style={style}
          expander={expander}
          busy={rows.saving}
          onDraft={setDraft}
          onSave={save}
          onCancel={cancel}
        />
      )
    }
    if (item.kind !== 'row') return null
    return (
      <GridRow
        row={item.row}
        id={item.id}
        columns={columns}
        rowIndex={item.index + 2}
        style={style}
        expanded={expander ? expanded.has(item.id) : undefined}
        end={endLane}
        busy={busy}
        onToggle={expander ? toggle : undefined}
        onEdit={rows.update ? edit : undefined}
        onRemove={rows.remove ? remove : undefined}
        confirmRemove={confirmDelete}
      />
    )
  }

  // Every row lays its cells on the same tracks: the expander lane, the columns
  // (each as wide as it has been made, or with a share of the width but never
  // less than its least) and the end lane. The lanes stick to the sides as the
  // columns scroll between them.
  const start = expander ? 'var(--prism-data-grid-expander-width)' : '0px'
  const end = actions
    ? 'var(--prism-data-grid-actions-width)'
    : filterable
      ? 'var(--prism-data-grid-expander-width)'
      : '0px'
  const tracks = `${start} minmax(0, 1fr) ${end}`
  const { cells, least } = columnTracks(columns, sizing.widths)

  return (
    <div
      className="prism-data-grid__view"
      style={cssVars({
        '--_prism-data-grid-tracks': tracks,
        '--_prism-data-grid-cells': cells,
        '--_prism-data-grid-start': start,
        '--_prism-data-grid-end': end,
        '--_prism-data-grid-least': `calc(${start} + ${least} + ${end})`,
        '--_prism-data-grid-cells-least': `calc(${least})`,
        '--_prism-data-grid-timeline': timeline,
      })}
    >
      <div
        ref={table}
        className="prism-data-grid__table"
        role="table"
        aria-label={label}
        // The header, the rows and the summary row.
        aria-rowcount={view.total + 1 + Number(summarised)}
        aria-busy={rows.loading || undefined}
      >
        <GridHeader
          columns={columns}
          sort={view.sort}
          filters={view.filters}
          widths={sizing.widths}
          expander={expander}
          actions={actions}
          locked={editing !== null}
          onSort={(key) => {
            view.toggleSort(key)
            toTop()
          }}
          onFilter={(key: string, filter: GridFilter) => {
            view.setFilter(key, filter)
            toTop()
          }}
          onResize={sizing.resize}
          onFit={sizing.fit}
          filtering={view.filtering}
          onClearFilters={
            filterable
              ? () => {
                  view.clearFilters()
                  toTop()
                }
              : undefined
          }
          onFocus={reveal}
        />
        <VirtualRows
          viewportRef={body}
          items={items}
          heightOf={heightOf}
          keyOf={(item) => (item.kind === 'new' ? 'new' : `${item.kind}:${item.id}`)}
          render={renderItem}
          onScroll={onScroll}
          empty={
            <div className="prism-data-grid__message">
              {rows.loading ? <Progress /> : rows.failed ? labels.unreadable : labels.noRows}
            </div>
          }
        />
        {summarised && (
          <GridSummary
            columns={columns}
            values={summaries}
            rowIndex={view.total + 2}
            expander={expander}
            end={endLane}
          />
        )}
      </div>
      <GridFooter
        total={view.total}
        page={view.page}
        pages={view.pages}
        error={invalid?.message ?? rows.error}
        busy={busy}
        locale={locale}
        onPage={goToPage}
        onAdd={rows.create && (() => edit())}
        onRetry={rows.failed ? rows.reload : undefined}
        onFitColumns={columns.some((c) => c.resizable) ? sizing.fitAll : undefined}
      />
    </div>
  )
}
