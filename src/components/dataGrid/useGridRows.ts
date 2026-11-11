import { useEffect, useMemo, useState } from 'react'
import type { DataGridSource, Row } from './types'

export interface GridRows {
  rows: readonly Row[]
  /** Whether the rows are being read. */
  loading: boolean
  /** Whether a change is on its way to the source. */
  saving: boolean
  /** What went wrong last, until the next try. */
  error: string | null
  /** Whether the rows couldn't be read, so there is nothing to show but a retry. */
  failed: boolean
  reload(): void
  /** Each resolves to whether it went through, and is left out where the source can't do it. */
  create?: (row: Row) => Promise<boolean>
  update?: (row: Row, changes: Row) => Promise<boolean>
  remove?: (row: Row) => Promise<boolean>
}

/** What a read of the source gave, and which read it was. */
interface Read {
  request: object
  rows: readonly Row[]
  error: string | null
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** What a value is, for an error: "an object", "a string", "nothing". */
function describe(value: unknown) {
  if (value == null) return 'nothing'
  const type = typeof value
  return `${/^[aeiou]/.test(type) ? 'an' : 'a'} ${type}`
}

/**
 * The rows of a grid: `data` as given, or what `source` reads, read again when
 * the source changes, with its changes made through it and then to the rows. A
 * source made in render is a new one each render, so make it once (outside the
 * component, or with useMemo).
 */
export function useGridRows(data: readonly Row[] | undefined, source: DataGridSource | undefined): GridRows {
  const [reads, setReads] = useState(0)
  // A new object for each read wanted, so a read that comes back is known by it.
  const request = useMemo(() => ({ source, reads }), [source, reads])
  const [read, setRead] = useState<Read | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!request.source) return
    const abort = new AbortController()
    request.source.read(abort.signal).then(
      (rows: unknown) => {
        if (abort.signal.aborted) return
        // An API's own wrapping ({ data: [...] }, say) would otherwise only fail as the grid drew it.
        if (Array.isArray(rows)) setRead({ request, rows, error: null })
        else setRead({ request, rows: [], error: `The source gave ${describe(rows)}, not a list of rows.` })
      },
      (reason: unknown) => {
        if (!abort.signal.aborted) setRead({ request, rows: [], error: messageOf(reason) })
      },
    )
    return () => abort.abort()
  }, [request])

  // Until the read wanted comes back, what an earlier one gave doesn't count.
  const current = read?.request === request ? read : null

  async function change(work: () => Promise<(rows: readonly Row[]) => readonly Row[]>) {
    setSaving(true)
    setSaveError(null)
    try {
      const apply = await work()
      setRead((r) => r && { ...r, rows: apply(r.rows) })
      return true
    } catch (reason) {
      setSaveError(messageOf(reason))
      return false
    } finally {
      setSaving(false)
    }
  }

  const { create, update, remove } = source ?? {}
  return {
    rows: data ?? current?.rows ?? [],
    loading: Boolean(source) && !current,
    saving,
    error: saveError ?? current?.error ?? null,
    failed: Boolean(current?.error),
    reload: () => {
      setSaveError(null)
      setReads((n) => n + 1)
    },
    create:
      create &&
      ((row) =>
        change(async () => {
          const made = await create.call(source, row)
          return (rows) => [...rows, made]
        })),
    update:
      update &&
      ((row, changes) =>
        change(async () => {
          const stored = await update.call(source, row, changes)
          return (rows) => rows.map((r) => (r === row ? stored : r))
        })),
    remove:
      remove &&
      ((row) =>
        change(async () => {
          await remove.call(source, row)
          return (rows) => rows.filter((r) => r !== row)
        })),
  }
}
