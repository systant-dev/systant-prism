import { cx } from '../../shared'
import { kindOf } from './columnTypes'
import { RowFrame } from './RowFrame'
import type { GridColumn } from './types'
import { useGridLabels } from './useLabels'

export interface GridSummaryProps {
  columns: readonly GridColumn[]
  /** Each summarised column's summary, by property name; null where there was nothing to summarise. */
  values: ReadonlyMap<string, number | null>
  /** Where it comes among the rows, from 1, counting the header. */
  rowIndex: number
  /** Whether there is an expander lane before the columns, and an end lane after them. */
  expander: boolean
  end: boolean
}

// The summary row under the rows: in each summarised column, what its summary
// is called and its value, over every row that passes the filters, on every
// page. Like the header, it lies outside the body, so it stays in view, and its
// columns move on a track as the body scrolls (DataGrid.styles.ts).
export function GridSummary({ columns, values, rowIndex, expander, end }: GridSummaryProps) {
  return (
    <div className="prism-data-grid__foot" role="rowgroup">
      <RowFrame
        className="prism-data-grid__row--summary"
        aria-rowindex={rowIndex}
        start={expander && {}}
        end={end && {}}
      >
        {columns.map((column) => (
          <SummaryCell key={column.key} column={column} value={values.get(column.key) ?? null} />
        ))}
      </RowFrame>
    </div>
  )
}

function SummaryCell({ column, value }: { column: GridColumn; value: number | null }) {
  const labels = useGridLabels()
  const { summary } = column
  if (!summary) return <span className="prism-data-grid__cell" role="cell" />
  // As its column writes its values, mask and all.
  const text = value === null ? '' : kindOf(column).format(value, column)
  return (
    <span
      className={cx('prism-data-grid__cell', 'prism-data-grid__cell--end')}
      role="cell"
      title={`${labels[summary]}: ${text}`}
    >
      {/* The label over the value, so a narrow column has the whole of its width for the value. */}
      <span className="prism-data-grid__summary-label">{labels[summary]}</span>{' '}
      <span className="prism-data-grid__summary-value">{text}</span>
    </span>
  )
}
