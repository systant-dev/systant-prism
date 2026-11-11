import type { CSSProperties } from 'react'
import { Cross, cx, Tick } from '../../shared'
import { CellValue, EDITORS } from './cells'
import { canEdit, kindOf } from './columnTypes'
import { held } from './held'
import { IconButton } from './icons'
import { RowFrame } from './RowFrame'
import type { GridColumn, Row } from './types'
import { useGridLabels } from './useLabels'

export interface GridEditorProps {
  /** The row being edited, or undefined for a new one. */
  row?: Row
  /** The key column, which shows but can't be changed. */
  rowKey: string
  columns: readonly GridColumn[]
  /** Where the row being edited comes in the table, as its row did; none for a new one. */
  rowIndex?: number
  /** What each editor holds, by property name. */
  draft: Readonly<Record<string, unknown>>
  /** The column whose value can't be saved as it is, if one can't. */
  invalid: string | null
  style: CSSProperties
  /** Whether there is an expander column, which it leaves empty. */
  expander: boolean
  busy: boolean
  onDraft(key: string, draft: unknown): void
  onSave(): void
  onCancel(): void
}

// A row being edited or added: each value in its type's editor (cells.tsx),
// with buttons to save and cancel. Enter in a text field saves too, and Escape
// cancels, unless it is closing a dropdown's menu or a date's calendar. The
// key, which the source gives, and JSON only show.
export function GridEditor({
  row,
  rowKey,
  columns,
  rowIndex,
  draft,
  invalid,
  style,
  expander,
  busy,
  onDraft,
  onSave,
  onCancel,
}: GridEditorProps) {
  const labels = useGridLabels()
  const first = columns.find((c) => canEdit(c, rowKey))
  const save = () => {
    if (!busy) onSave()
  }
  return (
    <RowFrame
      className="prism-data-grid__row--editing"
      aria-label={row ? labels.editedRow : labels.newRow}
      aria-rowindex={rowIndex}
      style={style}
      onKeyDown={(event) => {
        // A popup open in the row closes on this Escape itself.
        if (event.key === 'Escape' && !event.currentTarget.querySelector('[aria-expanded="true"]')) onCancel()
      }}
      start={expander && {}}
      end={{
        className: 'prism-data-grid__cell--actions',
        content: (
          <>
            <IconButton label={labels.save} disabled={busy} onClick={onSave}>
              <Tick />
            </IconButton>
            <IconButton label={labels.cancel} onClick={onCancel}>
              <Cross />
            </IconButton>
          </>
        ),
      }}
    >
      {columns.map((column) => {
        const Editor = canEdit(column, rowKey) ? EDITORS[column.type] : null
        return (
          <span
            key={column.key}
            className={cx('prism-data-grid__cell', kindOf(column).alignEnd && 'prism-data-grid__cell--end')}
            role="cell"
          >
            {Editor ? (
              <Editor
                column={column}
                draft={held(draft, column.key)}
                invalid={invalid === column.key}
                autoFocus={column === first}
                onDraft={(value) => onDraft(column.key, value)}
                onCommit={save}
              />
            ) : (
              <CellValue column={column} value={held(row, column.key)} />
            )}
          </span>
        )
      })}
    </RowFrame>
  )
}
