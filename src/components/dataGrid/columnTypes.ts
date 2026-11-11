import { dayOf, formatDay, isDays, isoDay, withinDays } from './dates'
import { applyInputMask, fillsMask, maskPlaceholder, unmask } from './inputMask'
import { DEFAULT_LABELS, type DataGridLabels } from './labels'
import { currencyDecimals, plainNumber } from './locale'
import { formatMoney, formatNumberValue, numberMatcher, numberValue, readNumber } from './numbers'
import { holding, plainText, textOf, typed } from './text'
import type { DataGridColumnType, GridColumn, GridFilter, GridOption } from './types'

/**
 * What a type of column does with its values: how they show, sort and filter,
 * and how the editor takes them and gives them back. Each type is one of these
 * (KINDS); its editor and filter are drawn by cells.tsx. A new type is a new
 * entry in both, and nothing else need change. What they share of text,
 * numbers and dates is in text.ts, numbers.ts and dates.ts.
 */
export interface ColumnKind {
  /** The text a value shows as, and that a screen reader and the cell's title give. */
  format(value: unknown, column: GridColumn): string
  /** What it sorts by: numbers by size, text as people read it. */
  sortKey(value: unknown, column: GridColumn): number | string
  /**
   * A test of whether a value passes the column's filter, made once for the
   * filter and put to every row. Only asked of a filter in use.
   */
  matcher(filter: GridFilter, column: GridColumn): (value: unknown) => boolean
  /** What its filter takes: text to look for, choices to pick from, or a run of days on a calendar. */
  filter: 'text' | 'choices' | 'days'
  /** Whether its values line up at the end of the cell, as numbers do. */
  alignEnd: boolean
  /** Whether the editor can change it. */
  editable: boolean
  /** What the editor starts with for a value. */
  toDraft(value: unknown, column: GridColumn): unknown
  /** The value the editor gives back, as it is to be stored. Only asked of a draft that passed `check`. */
  fromDraft(draft: unknown, column: GridColumn): unknown
  /**
   * What is wrong with a draft, to finish "Price …" ("must be a number"), in the grid's
   * words or else English, or null where it can be saved.
   */
  check?(draft: unknown, column: GridColumn, labels?: ProblemLabels): string | null
}

/** The words for what is wrong with a draft. */
export type ProblemLabels = Pick<DataGridLabels, 'mustBeNumber' | 'mustBeAmount' | 'mustFill'>

/** A test of whether a key is among the choices a filter picked. */
function picking(filter: GridFilter) {
  const keys = new Set(Array.isArray(filter) ? filter : [])
  return (key: string) => keys.has(key)
}

const optionOf = (value: unknown, column: GridColumn) => column.options.find((o) => o.key === textOf(value))

/** The choices of a checkbox column, to filter by, and what each shows as to those who can't see its tick. */
export function checkboxOptions({
  yes,
  no,
}: Pick<DataGridLabels, 'yes' | 'no'> = DEFAULT_LABELS): readonly GridOption[] {
  return [
    { value: true, label: yes, key: 'true' },
    { value: false, label: no, key: 'false' },
  ]
}

/** Text as it is, which numbers and JSON start from too. */
const plain: ColumnKind = {
  format: plainText,
  sortKey: plainText,
  matcher: (filter) => {
    const holds = holding(filter)
    return (value) => holds(plainText(value))
  },
  filter: 'text',
  alignEnd: false,
  editable: true,
  toDraft: textOf,
  fromDraft: typed,
}

/** A text value as its column's input mask writes it, or null where it has none or the value doesn't fit it. */
function masked(value: unknown, column: GridColumn) {
  return column.mask && value != null ? applyInputMask(String(value), column.mask) : null
}

/**
 * Text, which an input mask (inputMask.ts) shapes as it is typed, and writes as
 * it is shown, wherever the value fits it. A value the editor gives back fills
 * every slot of the mask, or is empty, and is saved as the mask writes it or,
 * where the column says, as only what is in its slots.
 */
const text: ColumnKind = {
  ...plain,
  format: (value, column) => masked(value, column) ?? plainText(value),
  // As it is stored and as it is shown, so 0207 finds (020) 7946-0958 and the other way round.
  matcher: (filter, column) => {
    const holds = holding(filter)
    return (value) => holds(plainText(value)) || holds(text.format(value, column))
  },
  toDraft: (value, column) => masked(value, column) ?? textOf(value),
  fromDraft: (draft, column) => {
    const entry = typed(draft)
    if (entry === null || !column.mask) return entry
    return column.saveMask ? (applyInputMask(entry, column.mask) ?? entry) : unmask(entry, column.mask)
  },
  check: (draft, column, labels = DEFAULT_LABELS) =>
    column.mask && typed(draft) !== null && !fillsMask(String(draft), column.mask)
      ? labels.mustFill(maskPlaceholder(column.mask))
      : null,
}

/**
 * Numbers, written and read as the column's locale does: 1234,5 in de-DE. The
 * editor holds the number with every decimal and no grouping, and takes it
 * back grouped or not.
 */
const number: ColumnKind = {
  ...plain,
  format: formatNumberValue,
  sortKey: (value) => numberValue(value) ?? plainText(value),
  matcher: numberMatcher(formatNumberValue),
  alignEnd: true,
  toDraft: (value, column) => {
    const n = numberValue(value)
    return n === null ? textOf(value) : plainNumber(n, column.locale)
  },
  fromDraft: (draft, column) => {
    const entry = typed(draft)
    return entry === null ? null : readNumber(entry, column)
  },
  check: (draft, column, labels = DEFAULT_LABELS) => {
    const entry = typed(draft)
    return entry === null || readNumber(entry, column) !== null ? null : labels.mustBeNumber
  },
}

/**
 * Amounts of the column's currency, written as its locale writes them (£1,000.00
 * in en-GB, 1 000,00 € in fr-FR) unless a mask says otherwise. They are numbers
 * otherwise, but that the editor holds the currency's decimals (1234.50, 1234
 * for yen) and takes its symbol or code typed with the amount.
 */
const money: ColumnKind = {
  ...number,
  format: formatMoney,
  matcher: numberMatcher(formatMoney),
  toDraft: (value, column) => {
    const n = numberValue(value)
    return n === null ? textOf(value) : plainNumber(n, column.locale, currencyDecimals(column.locale, column.currency))
  },
  check: (draft, column, labels = DEFAULT_LABELS) => {
    const entry = typed(draft)
    return entry === null || readNumber(entry, column) !== null ? null : labels.mustBeAmount
  },
}

export const KINDS: Readonly<Record<DataGridColumnType, ColumnKind>> = {
  text,
  number,
  money,
  checkbox: {
    // As its choices are called: the grid's words for ticked and unticked, and nothing for neither.
    format: (value, column) => column.options.find((option) => option.value === value)?.label ?? '',
    sortKey: (value) => Number(value === true),
    // An empty value counts as unticked.
    matcher: (filter) => {
      const picked = picking(filter)
      return (value) => picked(String(value === true))
    },
    filter: 'choices',
    alignEnd: false,
    editable: true,
    toDraft: (value) => value === true,
    fromDraft: Boolean,
  },
  dropdown: {
    format: (value, column) => optionOf(value, column)?.label ?? plainText(value),
    sortKey: (value, column) => optionOf(value, column)?.label ?? plainText(value),
    matcher: (filter) => {
      const picked = picking(filter)
      return (value) => picked(textOf(value))
    },
    filter: 'choices',
    alignEnd: false,
    editable: true,
    toDraft: (value) => value ?? null,
    fromDraft: (draft) => draft ?? null,
  },
  date: {
    format: formatDay,
    sortKey: (value) => dayOf(value)?.getTime() ?? plainText(value),
    // A run of days from its calendar, or text looked for in the date as it shows.
    matcher: (filter, column) => {
      if (isDays(filter)) return (value) => withinDays(value, filter)
      const holds = holding(filter)
      return (value) => holds(formatDay(value, column))
    },
    filter: 'days',
    alignEnd: false,
    editable: true,
    toDraft: dayOf,
    fromDraft: (draft) => (draft instanceof Date ? isoDay(draft) : null),
  },
  json: { ...plain, editable: false },
}

export const kindOf = (column: GridColumn) => KINDS[column.type]

/** Whether a filter is in use: text with something in it, choices with any picked, or a run of days. */
export function inUse(filter: GridFilter | undefined): filter is GridFilter {
  if (filter === undefined) return false
  if (typeof filter === 'string') return filter.trim() !== ''
  return isDays(filter) || filter.length > 0
}

/** Whether a column can be changed in the editor: not the key, which the source gives, nor JSON. */
export function canEdit(column: GridColumn, rowKey: string) {
  return kindOf(column).editable && column.key !== rowKey
}
