// The vertical selector's entries are stacked plain text on whatever they sit
// on, with no glass of their own. What it shares with the horizontal selector
// (the two pills, the glide, the press and its shrink, the glass) is
// src/components/selector/core/selector.styles.ts, tuned by the tokens here.
//
// The pills span the list's width and follow the entry's height, for lists
// whose entries differ in height. They round like a button, from the card's
// corner tokens, which on an entry of usual height makes a capsule.
//
// The tuning properties are set on :where(:root) rather than on the selector,
// so they can be overridden on the selector itself or once on any ancestor.
import { selectorStyles } from '../core'

const radius = 'calc(var(--prism-card-radius) * var(--prism-card-squircle-scale))'

export const verticalSelectorStyles = `
:where(:root) {
  --prism-vertical-selector-gap: 2px;
  --prism-vertical-selector-padding: 10px 16px;
  --prism-vertical-selector-idle-opacity: 0.85;
  --prism-vertical-selector-glass: #ffffff;
  --prism-vertical-selector-glass-opacity: 0.16;
  --prism-vertical-selector-hover-opacity: 0.5;
  --prism-vertical-selector-rim:
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    inset 0 -1px 0 rgb(255 255 255 / 0.12),
    0 0 0 1px rgb(255 255 255 / 0.14);
  --prism-vertical-selector-shadow: 0 4px 14px rgb(0 0 0 / 0.14);
  --prism-vertical-selector-pressed-shadow:
    0 0 1px rgb(0 0 0 / 0.25),
    0 0 10px rgb(0 0 0 / 0.18);
  --prism-vertical-selector-press-halo: rgb(0 0 0 / 0.3);
  --prism-vertical-selector-press-tint: #000000;
  --prism-vertical-selector-press-tint-opacity: 0.1;
  --prism-vertical-selector-glide-duration: 400ms;
  --prism-vertical-selector-glide-easing: var(--prism-ease-out-strong);
  --prism-vertical-selector-hover-glide-duration: 300ms;
  --prism-vertical-selector-hover-fade-in-duration: 180ms;
  --prism-vertical-selector-hover-fade-out-duration: 280ms;
  --prism-vertical-selector-hover-delay: 70ms;
  --prism-vertical-selector-appear-delay: 120ms;
  --prism-vertical-selector-appear-duration: 450ms;
  --prism-vertical-selector-focus: #6d7cff;
}

/* Until the entries are measured. */
:where(.prism-vertical-selector) {
  --prism-press-scale: 0.985;
}
${selectorStyles('vertical')}
.prism-vertical-selector {
  display: flex;
  flex-direction: column;
  /* It takes its parent's text colour, or --_prism-vertical-selector-fg, that
     colour shaded to stay readable, set inline by the selector where it must be.
     currentColor, for color, is the inherited colour. */
  --_prism-vertical-selector-fg: initial;
  color: var(--_prism-vertical-selector-fg, currentColor);
}

.prism-vertical-selector__option { border-radius: ${radius}; }

.prism-vertical-selector__indicator {
  top: 0;
  left: 0;
  right: 0;
  border-radius: ${radius};
}
`
