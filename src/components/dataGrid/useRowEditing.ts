import { useState } from 'react'
import { useHandler } from '../../shared'
import { canEdit, kindOf } from './columnTypes'
import { held } from './held'
import type { GridColumn, Row } from './types'
import type { GridRows } from './useGridRows'
import { useGridLabels } from './useLabels'

interface Editing {
  /** The row being edited, or undefined for a new one. */
  row?: Row
  /** What each editor holds, and what it held to begin with. */
  draft: Record<string, unknown>
  start: Readonly<Record<string, unknown>>
}

/** A value the editor holds that can't be saved: its column, and why. */
export interface Invalid {
  key: string
  message: string
}

export interface RowEditing {
  /** The row being edited, or undefined for a new one, and what its editors hold; null while none is. */
  editing: { row?: Row; draft: Readonly<Record<string, unknown>> } | null
  invalid: Invalid | null
  /** Starts editing `row`, or a new row for none. The same from render to render. */
  edit(row?: Row): void
  setDraft(key: string, draft: unknown): void
  cancel(): void
  /** Checks what is held, and sends it to the source; editing stops once it has gone through. */
  save(): Promise<void>
}

const sameDraft = (a: unknown, b: unknown) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : Object.is(a, b)

/**
 * The columns a save sends. For a row being edited, only those changed, so a
 * value the editor would write back differently (a timestamp in a date column,
 * say) is left as it was; for a new row, every one, untouched ones included,
 * as a toggle left off is still a value.
 */
function sentColumns({ row, draft, start }: Editing, columns: readonly GridColumn[], rowKey: string) {
  return columns.filter((c) => canEdit(c, rowKey) && (!row || !sameDraft(held(draft, c.key), held(start, c.key))))
}

/**
 * Editing a row, or a new one: what each editor holds, as its column's type
 * drafts it; checking it as the types do; and sending what changed, as the
 * types store it, through `rows`. `onAdd` is called as a new row is started.
 */
export function useRowEditing(
  columns: readonly GridColumn[],
  rowKey: string,
  rows: GridRows,
  onAdd: () => void,
): RowEditing {
  const labels = useGridLabels()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [invalid, setInvalid] = useState<Invalid | null>(null)

  const edit = useHandler((row?: Row) => {
    const start = Object.fromEntries(columns.map((c) => [c.key, kindOf(c).toDraft(held(row, c.key), c)]))
    setEditing({ row, draft: start, start })
    setInvalid(null)
    if (!row) onAdd()
  })

  const cancel = () => {
    setEditing(null)
    setInvalid(null)
  }

  async function save() {
    if (!editing) return
    const sent = sentColumns(editing, columns, rowKey)
    for (const column of sent) {
      const problem = kindOf(column).check?.(held(editing.draft, column.key), column, labels)
      if (problem) return setInvalid({ key: column.key, message: labels.invalid(column.header, problem) })
    }
    const values = Object.fromEntries(sent.map((c) => [c.key, kindOf(c).fromDraft(held(editing.draft, c.key), c)]))
    const { row } = editing
    const saved = row
      ? !Object.keys(values).length || (await rows.update!(row, values))
      : await rows.create!(Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)))
    if (saved) cancel()
  }

  return {
    editing,
    invalid,
    edit,
    setDraft: (key, draft) => {
      setEditing((e) => e && { ...e, draft: { ...e.draft, [key]: draft } })
      if (invalid?.key === key) setInvalid(null)
    },
    cancel,
    save,
  }
}
