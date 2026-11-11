import { Cross } from '../../shared'

export interface TextFieldClearProps {
  label: string
  disabled: boolean
  onClick: () => void
}

/** The short separator and the clear button at the end of a text field. */
export function TextFieldClear({ label, disabled, onClick }: TextFieldClearProps) {
  return (
    <>
      <span className="prism-textbox__separator" aria-hidden="true" />
      <button
        type="button"
        className="prism-textbox__icon-button prism-textbox__clear"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        <Cross size={12} />
      </button>
    </>
  )
}
