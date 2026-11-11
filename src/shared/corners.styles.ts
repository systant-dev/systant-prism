// The corner tokens shared by every component that rounds its corners like a
// card, so a button and a card always match. Each component renders this sheet
// as well as its own, so the tokens are there whichever is on the page.
//
// Squircle corners come from `corner-shape`, with plain border-radius as the
// fallback. A squircle hugs the corner more tightly than a circular arc at the
// same radius, so the radius is scaled up by --prism-card-squircle-scale where
// supported to keep the perceived roundness similar.
//
// They are set on :where(:root) so they can be overridden on the element itself
// or once on any ancestor, and :where() keeps them below any :root rule of the
// page's own.
export const cornerStyles = `
:where(:root) {
  --prism-card-radius: 16px;
  --prism-card-squircle-scale: 1.6;
}
`
