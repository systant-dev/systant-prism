// The button's drop shadow, and the closer one with a soft dark halo all the
// way round that it gives way to while pressed. The shadows and their
// cross-fade are the shared press's (src/effects/press), drawn by the
// .prism-press__shadow span usePress renders; this sheet sets the button's
// shadows and points the press's tuning properties at the button's own, on
// :where(.prism-button), so they are set on :where(:root) like the rest and can
// be overridden on the button or once on any ancestor.
export const shadowStyles = `
:where(:root) {
  /* The press's defaults (src/effects/press), light and dark, kept in one place. */
  --prism-button-shadow: var(--prism-press-rest-shadow);
  --prism-button-pressed-shadow: var(--prism-press-pressed-shadow);
  --prism-button-press-halo: var(--prism-press-halo);
  --prism-button-press-halo-blur: var(--prism-press-halo-blur);
  --prism-button-press-halo-spread: var(--prism-press-halo-spread);
}

:where(.prism-button) {
  --prism-press-rest-shadow: var(--prism-button-shadow);
  --prism-press-pressed-shadow: var(--prism-button-pressed-shadow);
  --prism-press-halo: var(--prism-button-press-halo);
  --prism-press-halo-blur: var(--prism-button-press-halo-blur);
  --prism-press-halo-spread: var(--prism-button-press-halo-spread);
}
`
