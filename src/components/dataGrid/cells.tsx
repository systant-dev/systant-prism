import { useLayoutEffect, useRef, type ComponentType } from 'react'
import { Calendar } from '../calendar'
import { Combobox } from '../combobox'
import { MenuButton } from '../menu'
import { Textbox } from '../textbox'
import { Toggle } from '../toggle'
import { Chevron, Tick } from '../../shared'
import { kindOf } from './columnTypes'
import { isDays } from './dates'
import { conform, digitsOnly, maskPlaceholder } from './inputMask'
import { onEnter } from './onEnter'
import { textOf } from './text'
import type { DataGridColumnType, GridColumn, GridFilter } from './types'
import { useGridLabels } from './useLabels'

// How each type of column is drawn: its values, its editor and its filter. What
// the types do with values is columnTypes.ts's; this is only what they look like.

/** A value as its column shows it: a tick for a ticked checkbox, else its text. */
export function CellValue({
  column,
  value,
  text = kindOf(column).format(value, column),
}: {
  column: GridColumn
  value: unknown
  /** The value as its column writes it, where the caller has it already. */
  text?: string
}) {
  if (column.type !== 'checkbox') return text
  return (
    <>
      {value === true && <Tick />}
      <span className="prism-data-grid__hidden">{text}</span>
    </>
  )
}

export interface EditorProps {
  column: GridColumn
  /** What it holds: the column type's draft (columnTypes.ts). */
  draft: unknown
  /** Whether what it holds can't be saved, which its column's check said. */
  invalid: boolean
  autoFocus: boolean
  onDraft(draft: unknown): void
  /** Saves the row, as Enter in a text field does. */
  onCommit(): void
}

function TextEditor(props: EditorProps) {
  const { column, draft, invalid, autoFocus, onDraft, onCommit } = props
  if (column.type === 'text' && column.mask) return <MaskedTextEditor {...props} mask={column.mask} />
  return (
    <Textbox
      className="prism-data-grid__field"
      aria-label={column.header}
      inputMode={column.type === 'number' || column.type === 'money' ? 'decimal' : undefined}
      value={String(draft ?? '')}
      aria-invalid={invalid || undefined}
      autoFocus={autoFocus}
      onChange={(event) => onDraft(event.target.value)}
      onKeyDown={onEnter(onCommit)}
    />
  )
}

// Text typed through an input mask (inputMask.ts): each change is fitted to the
// mask, and the caret put back after as many typed characters as were before
// it, so typing or deleting in the middle carries on from there rather than
// jumping to the end as the value is rewritten. Empty, it shows the mask's
// shape, with a keyboard of digits where only digits fit.
function MaskedTextEditor({
  column,
  draft,
  invalid,
  autoFocus,
  onDraft,
  onCommit,
  mask,
}: EditorProps & { mask: string }) {
  const input = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)

  // After the value is rewritten, which puts the caret at its end.
  useLayoutEffect(() => {
    const el = input.current
    if (caret.current === null || !el) return
    if (document.activeElement === el) el.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })

  return (
    <Textbox
      ref={input}
      className="prism-data-grid__field"
      aria-label={column.header}
      placeholder={maskPlaceholder(mask)}
      inputMode={digitsOnly(mask) ? 'numeric' : undefined}
      value={String(draft ?? '')}
      aria-invalid={invalid || undefined}
      autoFocus={autoFocus}
      onChange={(event) => {
        const { value, selectionStart } = event.target
        caret.current = conform(value.slice(0, selectionStart ?? value.length), mask).length
        onDraft(conform(value, mask))
      }}
      onKeyDown={onEnter(onCommit)}
    />
  )
}

function CheckboxEditor({ column, draft, autoFocus, onDraft }: EditorProps) {
  return <Toggle aria-label={column.header} checked={draft === true} autoFocus={autoFocus} onChange={onDraft} />
}

// A button showing the choice, opening a menu of them all.
function DropdownEditor({ column, draft, autoFocus, onDraft }: EditorProps) {
  const labels = useGridLabels()
  const chosen = column.options.find((o) => o.key === textOf(draft))
  return (
    <MenuButton
      variant="secondary"
      className="prism-data-grid__choice"
      aria-label={labels.choice(column.header, chosen?.label)}
      autoFocus={autoFocus}
      items={[
        // To clear it: a value picked can be taken back.
        { type: 'radio', label: labels.none, checked: draft == null, onSelect: () => onDraft(null) },
        { type: 'separator' },
        ...column.options.map((option) => ({
          type: 'radio' as const,
          label: option.label,
          checked: option === chosen,
          onSelect: () => onDraft(option.value),
        })),
      ]}
    >
      <span className="prism-data-grid__choice-text">{chosen?.label}</span>
      <Chevron point="down" />
    </MenuButton>
  )
}

function DateEditor({ column, draft, autoFocus, onDraft }: EditorProps) {
  return (
    <Calendar
      className="prism-data-grid__field"
      aria-label={column.header}
      value={draft instanceof Date ? draft : null}
      dateFormat={column.mask ?? undefined}
      locale={column.locale}
      autoFocus={autoFocus}
      onChange={onDraft}
    />
  )
}

/** Each type's editor; none for JSON, which only shows. */
export const EDITORS: Readonly<Record<DataGridColumnType, ComponentType<EditorProps> | null>> = {
  text: TextEditor,
  number: TextEditor,
  money: TextEditor,
  checkbox: CheckboxEditor,
  dropdown: DropdownEditor,
  date: DateEditor,
  json: null,
}

export interface FilterProps {
  column: GridColumn
  filter: GridFilter | undefined
  disabled: boolean
  onFilter(filter: GridFilter): void
}

/**
 * A column's filter, as its type takes one: the choices to show, ticked in a
 * combobox, for a dropdown or checkbox; a run of days, picked on a calendar or
 * typed in its field in the column's date mask, for a date; and text to look
 * for in the rest. A number column also takes a comparison, such as >10.
 */
export function CellFilter({ column, filter, disabled, onFilter }: FilterProps) {
  const labels = useGridLabels()
  const label = labels.filter(column.header)
  const takes = kindOf(column).filter
  if (takes === 'days') {
    return (
      <Calendar
        range
        className="prism-data-grid__field"
        aria-label={label}
        value={isDays(filter) ? filter : null}
        dateFormat={column.mask ?? undefined}
        locale={column.locale}
        disabled={disabled}
        // Cleared, it filters nothing.
        onChange={(days) => onFilter(days ?? '')}
      />
    )
  }
  if (takes === 'choices') {
    return (
      <Combobox
        className="prism-data-grid__field"
        aria-label={label}
        items={column.options.map((o) => ({ value: o.key, label: o.label }))}
        value={Array.isArray(filter) ? filter : []}
        disabled={disabled}
        onChange={onFilter}
      />
    )
  }
  return (
    <Textbox
      className="prism-data-grid__field"
      aria-label={label}
      title={
        column.type === 'number'
          ? labels.numberFilterHint
          : column.type === 'money'
            ? labels.moneyFilterHint
            : undefined
      }
      value={typeof filter === 'string' ? filter : ''}
      disabled={disabled}
      onChange={(event) => onFilter(event.target.value)}
    />
  )
}
