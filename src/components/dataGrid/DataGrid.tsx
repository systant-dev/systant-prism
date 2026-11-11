import { useBrowserLocale } from '../calendar'
import { Card, type CardProps } from '../card'
import { cx, PrismStyles } from '../../shared'
import { dataGridStyles } from './DataGrid.styles'
import { GridView } from './GridView'
import type { DataGridLabels } from './labels'
import type { DataGridColumns, DataGridSource, Row } from './types'
import { GridLabelsContext, useLabels } from './useLabels'
import { useSameContent } from './useSameContent'

/**
 * Where a grid's rows come from: `data`, the rows as JSON, in which each
 * property is a column and each array of objects a child collection; or
 * `source`, which reads them and takes changes to them (see restSource). One
 * or the other: a grid given both would show the one and still read the other.
 */
export type DataGridRows<R extends Row = Row> =
  { data: readonly R[]; source?: never } | { source: DataGridSource<R>; data?: never }

interface DataGridOwnProps<R extends Row> extends Omit<CardProps, 'children' | 'padding'> {
  /**
   * How columns and child collections are headed and what the columns hold, by
   * property name. Those left out are headed by their names and typed by their values.
   */
  columns?: DataGridColumns
  /** Whether columns have a filter under their header; a column's own `showFilter` overrides it. */
  showFilter?: boolean
  /**
   * Whether a summary row under the rows totals each number column but the
   * key; a column's own `summary` overrides it, and shows the row by itself.
   */
  showSummary?: boolean
  /**
   * Whether columns can be made wider and narrower from their headers: by
   * dragging a header's far edge, or double-clicking it to fit what is in the
   * column. A column's own `resizable` overrides it.
   */
  resizable?: boolean
  /**
   * A BCP 47 language tag ('en-GB', 'fr-FR') that numbers, money and dates
   * are written and read as, masks and filters too, and that text is sorted
   * by; the browser's if left out.
   */
  locale?: string
  /**
   * Money columns' currency, as an ISO 4217 code ('EUR'), unless they say. A
   * money column needs one, here or its own: without, it is a number column.
   */
  currency?: string
  /**
   * The grid's own words, in place of its English ones: any of DataGridLabels, the rest
   * staying as they are. Hold on to the same object from render to render where any is
   * a function, or every row is drawn again for a new one.
   */
  labels?: Partial<DataGridLabels>
  /** The property that tells rows apart. */
  rowKey?: string
  /** Whether a row's delete button asks before the row is deleted: once more on the button that takes its place. */
  confirmDelete?: boolean
  /** How many rows a page holds, or 0 for one page of them all. */
  pageSize?: number
  /** How tall a row is, in px. Rows are drawn only while in view, which needs their height. */
  rowHeight?: number
  /** How tall a row's child collections are when it is expanded, in px. */
  detailHeight?: number
  /**
   * A source for a row's child collection, for children read and changed
   * through an API of their own; leave it out, or return undefined, to show
   * the nested rows as they came. Called once each time the collection opens.
   */
  childSource?: (parent: R, collection: string) => DataGridSource | undefined
}

// A grid of JSON rows on a glass card: sorted by a press on a column's header,
// filtered under it, in pages, and drawn only while in view, so any number of
// rows scroll as smoothly as a few. Columns are the rows' properties, headed
// and typed by `columns` or else by their names and values; each type has its
// own look, sort, filter and editor (columnTypes.ts, cells.tsx), and each is
// as wide as it is dragged or fitted from its header (ColumnResizer.tsx), or
// else shares the grid's width. Nested arrays
// of objects are child collections, shown in a grid of their own under a row as
// it expands.
//
// Given a `source` rather than `data`, it reads its rows from there, and offers
// to add, edit and delete rows as far as the source can, sending each change
// to it and showing the row as it comes back. See GridView for how the parts fit.
export type DataGridProps<R extends Row = Row> = DataGridOwnProps<R> & DataGridRows<R>

export function DataGrid<R extends Row = Row>({
  data,
  source,
  columns,
  showFilter = true,
  showSummary = false,
  resizable = true,
  locale,
  currency,
  labels,
  rowKey = 'id',
  confirmDelete = true,
  pageSize = 0,
  rowHeight = 44,
  detailHeight = 320,
  childSource,
  className,
  'aria-label': label,
  ...rest
}: DataGridProps<R>) {
  // A server renders as en-US, and the browser's own takes over once it has hydrated.
  const browserLocale = useBrowserLocale()
  // Columns are plain data, often written inline: one the same as last time is last time's.
  const sameColumns = useSameContent(columns)
  const words = useLabels(labels)
  return (
    <GridLabelsContext value={words}>
      <PrismStyles href="prism-data-grid" css={dataGridStyles} />
      <Card padding="none" className={cx('prism-data-grid', className)} {...rest}>
        <GridView
          aria-label={label}
          data={data}
          source={source as DataGridSource | undefined}
          columns={sameColumns}
          showFilter={showFilter}
          showSummary={showSummary}
          resizable={resizable}
          locale={locale ?? browserLocale}
          currency={currency}
          rowKey={rowKey}
          confirmDelete={confirmDelete}
          pageSize={pageSize}
          rowHeight={rowHeight}
          detailHeight={detailHeight}
          childSource={childSource as ((parent: Row, collection: string) => DataGridSource | undefined) | undefined}
        />
      </Card>
    </GridLabelsContext>
  )
}
