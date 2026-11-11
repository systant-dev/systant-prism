import { checkboxOptions } from './columnTypes'
import { held } from './held'
import type { DataGridLabels } from './labels'
import { collatorOf } from './locale'
import { textOf } from './text'
import type {
  DataGridColumn,
  DataGridColumns,
  DataGridColumnType,
  DataGridOption,
  DataGridSummary,
  GridColumn,
  GridOption,
  Row,
} from './types'

function isRecord(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A nested collection: an array of objects, shown as a child grid rather than a column. */
function isCollection(value: unknown): value is Row[] {
  return Array.isArray(value) && value.length > 0 && value.every(isRecord)
}

/** The type a value suggests; a dropdown or date is only ever asked for. */
function typeOf(value: unknown): DataGridColumnType | null {
  if (value == null) return null
  if (typeof value === 'string') return 'text'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'checkbox'
  return 'json'
}

/** One type for a column whose values differ: text, unless one of them can't be edited as text. */
function merge(seen: DataGridColumnType | null, next: DataGridColumnType | null): DataGridColumnType | null {
  if (seen === null || seen === next) return next ?? seen
  if (next === null) return seen
  return seen === 'json' || next === 'json' ? 'json' : 'text'
}

function toOption(option: DataGridOption | unknown): GridOption {
  if (typeof option === 'object' && option !== null && 'label' in option && 'value' in option) {
    return { value: option.value, label: String(option.label), key: textOf(option.value) }
  }
  return { value: option, label: textOf(option), key: textOf(option) }
}

/** A column's choices: a checkbox's two, a dropdown's as given or else every value in it, in the locale's order. */
function optionsOf(
  type: DataGridColumnType,
  given: readonly DataGridOption[] | undefined,
  rows: readonly Row[],
  key: string,
  locale: string,
  labels: ShapeOptions['labels'],
) {
  if (type === 'checkbox') return checkboxOptions(labels)
  if (type !== 'dropdown') return []
  if (given) return given.map(toOption)
  const values = new Map<string, unknown>()
  for (const row of rows) {
    const value = held(row, key)
    if (value != null) values.set(textOf(value), value)
  }
  const order = collatorOf(locale)
  return [...values.values()].map(toOption).sort((a, b) => order.compare(a.label, b.label))
}

/**
 * What a column shows in the summary row: what it asks for, or a total where the
 * grid shows summaries, but never for the key (adding up ids means nothing) nor
 * for a column that isn't numbers or money.
 */
function summaryOf(
  key: string,
  type: DataGridColumnType,
  spec: DataGridColumn | undefined,
  { showSummary, rowKey }: ShapeOptions,
): DataGridSummary | null {
  if (type !== 'number' && type !== 'money') return null
  if (spec?.summary !== undefined) return spec.summary || null
  return showSummary && key !== rowKey ? 'total' : null
}

export interface ShapeOptions {
  /** The columns while there are no rows; the `columns` names if left out. */
  empty?: readonly string[]
  /** Whether columns have a filter, unless they say otherwise. */
  showFilter?: boolean
  /** Whether columns can be resized from their headers, unless they say otherwise. */
  resizable?: boolean
  /** Whether number columns show a total in the summary row, unless they say otherwise. */
  showSummary?: boolean
  /** The key column, which shows no summary unless it asks for one. */
  rowKey?: string
  /** The locale numbers and dates are written and read as; the runtime's own if left out. */
  locale?: string
  /** Money columns' currency, unless they say; a money column with neither is a number column. */
  currency?: string
  /** What a checkbox column's two choices are called; Yes and No if left out. */
  labels?: Pick<DataGridLabels, 'yes' | 'no'>
}

/** The locale of whatever runs this: the browser's, or a server's. */
const RUNTIME_LOCALE = new Intl.NumberFormat().resolvedOptions().locale

export interface GridShape {
  /** The properties shown as columns, in the order they first appear. */
  columns: GridColumn[]
  /** The properties holding nested collections, shown as child grids. */
  children: string[]
  /** The columns each collection has across every row's, for one that is empty in a row. */
  childColumns: Readonly<Record<string, string[]>>
}

/**
 * The columns and child collections of `rows`, from their property names, each
 * column headed and typed as `columns` says or else as its name and values
 * suggest. With no rows yet, the columns are `empty`, so a new row can still be
 * added to an empty collection: by default those `columns` names, which suits
 * a grid's own rows but not a child collection's, as `columns` describes every
 * level; a child grid is given its collection's `childColumns` instead. A
 * column has a filter as its `showFilter` says, or else as `showFilter` does,
 * a handle to resize it by as its `resizable` says, or else as `resizable`
 * does, and a summary as summaryOf says. A money column needs a currency, its own or
 * the grid's: without one it is a number column, as amounts of no currency
 * are only numbers, rather than guess one.
 */
export function readShape(rows: readonly Row[], columns: DataGridColumns = {}, options: ShapeOptions = {}): GridShape {
  const types = new Map<string, DataGridColumnType | null>()
  const nested = new Map<string, Row[]>()
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (isCollection(value)) {
        const list = nested.get(key) ?? []
        for (const child of value) list.push(child)
        nested.set(key, list)
      } else types.set(key, merge(types.get(key) ?? null, typeOf(value)))
    }
  }
  const { empty = Object.keys(columns), showFilter = true, resizable = true, locale = RUNTIME_LOCALE } = options
  if (!rows.length) for (const key of empty) types.set(key, null)
  const children = new Set(nested.keys())

  return {
    columns: [...types]
      .filter(([key]) => !children.has(key))
      .map(([key, inferred]) => {
        const spec = held(columns, key)
        const asked = spec?.type ?? inferred ?? 'text'
        const currency = asked === 'money' ? (spec?.currency ?? options.currency ?? '') : ''
        const type = asked === 'money' && !currency ? 'number' : asked
        return {
          key,
          header: spec?.header ?? key,
          type,
          options: optionsOf(type, spec?.options, rows, key, locale, options.labels),
          filterable: spec?.showFilter ?? showFilter,
          summary: summaryOf(key, type, spec, options),
          mask: spec?.mask ?? null,
          saveMask: spec?.saveMask ?? true,
          locale,
          currency,
          width: spec?.width ?? null,
          resizable: spec?.resizable ?? resizable,
        }
      }),
    children: [...children],
    childColumns: Object.fromEntries(
      [...nested].map(([key, childRows]) => [key, readShape(childRows, columns).columns.map((c) => c.key)]),
    ),
  }
}
