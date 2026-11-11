import type { CalendarRange } from '../calendar'

/** A row of the grid: one object of the JSON it is bound to. */
export type Row = Record<string, unknown>

/**
 * Where a grid's rows come from and go to. Only `read` is needed; the grid offers
 * adding, editing and deleting rows for the methods a source has, so a source
 * that can only be read gives a grid that can only be looked at. `restSource`
 * makes one for a REST collection; write your own for any other API.
 */
export interface DataGridSource<R extends Row = Row> {
  /** Every row (a GET of the collection). */
  read(signal?: AbortSignal): Promise<R[]>
  /** Adds a row, resolving to it as stored (a POST). */
  create?(row: Partial<R>): Promise<R>
  /** Changes a row, resolving to it as stored (a PATCH of `changes`, or a PUT of the whole row). */
  update?(row: R, changes: Partial<R>): Promise<R>
  /** Deletes a row (a DELETE). */
  remove?(row: R): Promise<void>
}

/**
 * What a column holds, which sets how its values show, sort, filter and are
 * edited. Left out, it is read from the values: text, number, checkbox for
 * booleans, and json for objects and arrays, which only show.
 */
export type DataGridColumnType = 'text' | 'number' | 'money' | 'checkbox' | 'dropdown' | 'date' | 'json'

/** A choice of a dropdown column: a value as stored, or one with a label to show for it. */
export type DataGridOption = string | number | { value: string | number; label: string }

/** What a column's cell in the summary row shows of its values. */
export type DataGridSummary = 'total' | 'min' | 'max' | 'average'

/** How a column is headed and what it holds, by property name. */
export interface DataGridColumn {
  /** Header text; the property's name if left out. */
  header?: string
  type?: DataGridColumnType
  /** A dropdown's choices; the values in the rows if left out. */
  options?: readonly DataGridOption[]
  /** Whether it has a filter under its header, whatever the grid's `showFilter` says. */
  showFilter?: boolean
  /**
   * What it shows in the summary row, for a number column; false for nothing,
   * whatever the grid's `showSummary` says.
   */
  summary?: DataGridSummary | false
  /**
   * How a number or date column writes its values: an Excel-style number mask,
   * `#,##0.00`, or a date pattern, `dd/MM/yyyy` (see docs/data-grid.md).
   */
  mask?: string
  /**
   * Whether a text column with an input mask saves its value as the mask writes
   * it, '(020) 7946-0958', or only what fills its slots, '02079460958'. True if left out.
   */
  saveMask?: boolean
  /**
   * A money column's currency, as an ISO 4217 code ('GBP'); the grid's if left
   * out. A money column with neither is a number column.
   */
  currency?: string
  /**
   * How wide it starts, in px, or 'auto' for as wide as its header and values
   * need, fitted once its rows are first shown. Left out, it shares the grid's
   * width with the others like it.
   */
  width?: number | 'auto'
  /** Whether its width can be changed from its header, whatever the grid's `resizable` says. */
  resizable?: boolean
}

/** Columns and child collections described by property name; those left out are read from the rows. */
export type DataGridColumns = Readonly<Partial<Record<string, DataGridColumn>>>

/** A choice, with what it is known by in the filter and editor's lists. */
export interface GridOption {
  value: unknown
  label: string
  /** Its value as text, telling choices apart. */
  key: string
}

export interface GridColumn {
  key: string
  header: string
  type: DataGridColumnType
  /** The choices of a dropdown or checkbox column; empty for the rest. */
  options: readonly GridOption[]
  /** Whether it has a filter under its header: its own `showFilter`, or else the grid's. */
  filterable: boolean
  /** What it shows in the summary row, if anything. */
  summary: DataGridSummary | null
  /** How it writes its values, if it says. */
  mask: string | null
  /** Whether a text column saves its input mask's own characters with its value. */
  saveMask: boolean
  /** The locale it writes and reads numbers and dates as, and sorts text by. */
  locale: string
  /** A money column's currency, an ISO 4217 code; '' for the rest. */
  currency: string
  /** How wide it starts: so many px, fitted to what is in it, or null for a share of the grid's width. */
  width: number | 'auto' | null
  /** Whether its header has a handle to change its width by: its own `resizable`, or else the grid's. */
  resizable: boolean
}

/** As aria-sort names them. */
export type SortDirection = 'ascending' | 'descending'

export interface GridSort {
  key: string
  direction: SortDirection
}

/**
 * A column's filter: text for most, the keys of the choices picked for a
 * dropdown or checkbox, or a run of days, picked on a calendar, for a date.
 */
export type GridFilter = string | readonly string[] | CalendarRange

/** The filter of each column, by property name. */
export type GridFilters = Readonly<Record<string, GridFilter>>
