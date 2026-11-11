/** The padding modifiers of `block` (a card, a popup): --pad-none, -sm (12px), -md (20px) and -lg (32px). */
export function paddingStyles(block: string) {
  return `
.${block}--pad-none { padding: 0; }
.${block}--pad-sm { padding: 12px; }
.${block}--pad-md { padding: 20px; }
.${block}--pad-lg { padding: 32px; }
`
}
