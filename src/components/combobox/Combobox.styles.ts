// A Combobox is a textbox's pill (../textField/textField.styles.ts) with a chevron
// at its far end, over a Popup (../popup/Popup.styles.ts) holding the list. This
// is only what those two don't bring.
//
// The chevron is the pill's end button (../textField/textField.styles.ts). It turns
// over while the list is open, unless prefers-reduced-motion asks otherwise.
//
// The list scrolls in a ScrollArea no taller than -max-height. An entry is a line
// of two columns, the label and a tick's width at the inline end, so ticking an
// entry never moves or rewraps its label. The active entry, the one the pointer
// is over or the arrow keys are on, takes a tint of the text colour itself
// (-active-opacity), which holds on any image a GlassBackdrop shows, where the
// popup's text may be light or dark whatever the theme. Its scroll margin stops a
// keyed move leaving it under the list's fading edge.
//
// The list and the "no matches" line are both always there, each hidden while
// empty, so a screen reader hears the line appear.
//
// The tuning properties are set on :where(:root), so they can be overridden on
// any ancestor.
export const comboboxStyles = `
:where(:root) {
  --prism-combobox-max-height: 240px;
  --prism-combobox-option-height: 36px;
  --prism-combobox-option-radius: 10px;
  --prism-combobox-active-opacity: 0.12;
  --prism-combobox-disabled-opacity: 0.45;
  --prism-combobox-empty-opacity: 0.7;
}

.prism-combobox__input { text-overflow: ellipsis; }

.prism-combobox__chevron--open > svg { rotate: 180deg; }

@media (prefers-reduced-motion: no-preference) {
  .prism-combobox__chevron > svg { transition: rotate 200ms var(--prism-ease-out); }
}

.prism-combobox__list {
  max-height: var(--prism-combobox-max-height);
  border-radius: inherit;
}

.prism-combobox__options {
  display: grid;
  padding: 4px;
}

.prism-combobox__options:empty,
.prism-combobox__empty:empty { display: none; }

.prism-combobox__option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 14px;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  min-height: var(--prism-combobox-option-height);
  padding: 6px 12px;
  border-radius: var(--prism-combobox-option-radius);
  cursor: pointer;
  user-select: none;
  scroll-margin-block: 24px;
  -webkit-tap-highlight-color: transparent;
}

.prism-combobox__option--active {
  background: color-mix(in srgb, currentColor calc(var(--prism-combobox-active-opacity) * 100%), transparent);
}

.prism-combobox__option[aria-disabled='true'] {
  cursor: default;
  opacity: var(--prism-combobox-disabled-opacity);
}

.prism-combobox__tick {
  grid-column: 2;
  display: block;
}

.prism-combobox__empty {
  padding: 14px 16px;
  opacity: var(--prism-combobox-empty-opacity);
}
`
