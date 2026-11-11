import { memo, useCallback, useState, type CSSProperties } from 'react'
import { Chevron, Cross, cx, Tick } from '../../shared'
import { CellValue } from './cells'
import { kindOf } from './columnTypes'
import { held } from './held'
import { Bin, IconButton, Pencil } from './icons'
import type { GridColumn, Row } from './types'
import { RowFrame } from './RowFrame'
import { useGridLabels } from './useLabels'
import { sameItemProps } from './VirtualRows'

export interface GridRowProps {
  row: Row
  /** What the grid knows the row by, which the expander toggles. */
  id: string
  columns: readonly GridColumn[]
  /** Where it is among all the rows that pass the filters, from 1, counting the header. */
  rowIndex: number
  style: CSSProperties
  /** Whether its child collections show; undefined where it has none. */
  expanded?: boolean
  /** Whether the grid has an end lane, where any buttons go, to keep a cell in it as the header does. */
  end: boolean
  /** Whether a change is on its way, which its buttons wait for. */
  busy: boolean
  /** Each left out where the grid can't: the same from render to render, so the row isn't drawn again for them. */
  onToggle?(id: string): void
  onEdit?(row: Row): void
  onRemove?(row: Row): void
  /** Whether the delete button asks first, giving way to buttons to delete the row or keep it. */
  confirmRemove?: boolean
}

// A row of the grid as it shows: its values, and buttons to show its children
// and to edit or delete it where the source can. Memoised, and drawn again only
// as its props change, as the rows in view are drawn again as the grid's state
// does (a filter typed, a row being edited).
export const GridRow = memo(function GridRow({
  row,
  id,
  columns,
  rowIndex,
  style,
  expanded,
  end,
  busy,
  onToggle,
  onEdit,
  onRemove,
  confirmRemove = false,
}: GridRowProps) {
  // Whether it is asking before it is deleted, or has just been told to keep
  // the row, which gives the focus back to the delete button the question took
  // the place of. Its own, as only it shows the question; a row scrolled out of
  // view forgets it.
  const [asking, setAsking] = useState<'no' | 'yes' | 'kept'>('no')
  const labels = useGridLabels()
  const remove = () => {
    setAsking('no')
    onRemove?.(row)
  }
  const keep = () => setAsking('kept')
  // Focuses a button as it takes the place of the one pressed, where autoFocus
  // didn't. The same function each render, so React calls it only as the button comes.
  const focus = useCallback((button: HTMLButtonElement | null) => button?.focus(), [])
  return (
    <RowFrame
      aria-rowindex={rowIndex}
      style={style}
      onKeyDown={(event) => {
        if (asking === 'yes' && event.key === 'Escape') keep()
      }}
      start={
        onToggle && {
          content: (
            <IconButton
              label={expanded ? labels.hideDetails : labels.showDetails}
              className="prism-data-grid__icon-button prism-data-grid__expander"
              aria-expanded={expanded}
              onClick={() => onToggle(id)}
            >
              <Chevron />
            </IconButton>
          ),
        }
      }
      end={
        end && {
          className: 'prism-data-grid__cell--actions',
          content:
            asking === 'yes' ? (
              <>
                <IconButton
                  label={labels.confirmDelete}
                  className="prism-data-grid__icon-button prism-data-grid__icon-button--danger"
                  disabled={busy}
                  ref={focus}
                  onClick={remove}
                >
                  <Tick />
                </IconButton>
                <IconButton label={labels.keepRow} onClick={keep}>
                  <Cross />
                </IconButton>
              </>
            ) : (
              <>
                {onEdit && (
                  <IconButton label={labels.editRow} disabled={busy} onClick={() => onEdit(row)}>
                    <Pencil />
                  </IconButton>
                )}
                {onRemove && (
                  <IconButton
                    label={labels.deleteRow}
                    disabled={busy}
                    ref={asking === 'kept' ? focus : undefined}
                    onClick={() => (confirmRemove ? setAsking('yes') : remove())}
                  >
                    <Bin />
                  </IconButton>
                )}
              </>
            ),
        }
      }
    >
      {columns.map((column) => {
        const kind = kindOf(column)
        const value = held(row, column.key)
        // Once, for the title and the cell both.
        const text = kind.format(value, column)
        return (
          <span
            key={column.key}
            className={cx(
              'prism-data-grid__cell',
              kind.alignEnd && 'prism-data-grid__cell--end',
              `prism-data-grid__cell--${column.type}`,
            )}
            role="cell"
            title={text}
          >
            <CellValue column={column} value={value} text={text} />
          </span>
        )
      })}
    </RowFrame>
  )
}, sameItemProps)
