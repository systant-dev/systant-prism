import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../../shared'

/** A lane at one side of a row: what is in it and any class of its own, or nothing where the grid has none. */
export type Lane = { content?: ReactNode; className?: string } | false | null | undefined

export interface RowFrameProps extends ComponentProps<'div'> {
  start?: Lane
  end?: Lane
  /** What its lanes are to a screen reader: cells, or a header's column headers. */
  laneRole?: 'cell' | 'columnheader'
}

const LANE = 'prism-data-grid__cell prism-data-grid__cell--control prism-data-grid__lane'

// The frame every row of the grid is laid on, the header's and the summary's
// as well as the rows' (see DataGrid.styles.ts): the start lane, the window the
// columns show through with the track they move on, which holds `children`,
// and the end lane. A lane the grid has is in every row, empty or not, so each
// has as many cells as the header has column headers.
export function RowFrame({ start, end, laneRole = 'cell', className, children, ...rest }: RowFrameProps) {
  return (
    <div className={cx('prism-data-grid__row', className)} role="row" {...rest}>
      {start && (
        <span className={cx(LANE, 'prism-data-grid__lane--start', start.className)} role={laneRole}>
          {start.content}
        </span>
      )}
      <div className="prism-data-grid__cells" role="presentation">
        <div className="prism-data-grid__track" role="presentation">
          {children}
        </div>
      </div>
      {end && (
        <span className={cx(LANE, 'prism-data-grid__lane--end', end.className)} role={laneRole}>
          {end.content}
        </span>
      )}
    </div>
  )
}
