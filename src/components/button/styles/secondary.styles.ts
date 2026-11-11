// The secondary button: the same glass, rim and light as the primary, but
// clearer and flatter, so it sits beside a primary without competing with it.
// A dark rim already outlines every button, so an outline can't mark it out as
// it would on a flat button, and the tint alone can't do it either: the glass
// has to stay tinted enough to keep light text legible over a bright
// background, since the blur evens out what is behind it but doesn't darken
// it. So it is told apart mostly by height: where the primary floats, with its
// full drop shadow and bright light inside the rim, the secondary sits almost
// on the surface, with little of the shadow and dimmer crescents and glints, as
// if its glass were thinner.
//
// It doesn't restyle anything. It points the primary's tuning properties at
// --prism-button-secondary-* ones, on :where(.prism-button--secondary), so
// they are set on :where(:root) like the rest and can be overridden on the
// button or once on any ancestor. A primary property set on a secondary button
// itself still wins, but one set on an ancestor doesn't reach it: the
// secondary's own property does that.
//
// The drop shadow is kept in part by the opacity of .prism-press__shadow,
// which holds both the resting and the pressed shadow (src/effects/press), so
// it scales both evenly, halo included, and is composited without repainting
// them. It isn't taken to 0, which would lose the pressed halo with it.
//
// The glints are dimmed the same way, by the opacity of the button's ::after.
// The pressed rule (highlights.styles.ts) is more specific, so a press still
// dims them to --prism-button-press-glint.
export const secondaryStyles = `
:where(:root) {
  --prism-button-secondary-glass-opacity: 0.12;
  --prism-button-secondary-hover-opacity: 0.25;
  --prism-button-secondary-pressed-opacity: 0.4;
  --prism-button-secondary-shadow-opacity: 0.15;
  --prism-button-secondary-highlight: rgb(255 255 255 / 0.4);
  --prism-button-secondary-bounce: rgb(255 255 255 / 0.2);
  --prism-button-secondary-glint-opacity: 0.4;
}

:where(.prism-button--secondary) {
  --prism-button-glass-opacity: var(--prism-button-secondary-glass-opacity);
  --prism-button-hover-opacity: var(--prism-button-secondary-hover-opacity);
  --prism-button-pressed-opacity: var(--prism-button-secondary-pressed-opacity);
  --prism-button-highlight: var(--prism-button-secondary-highlight);
  --prism-button-bounce: var(--prism-button-secondary-bounce);
}

.prism-button--secondary > .prism-press__shadow { opacity: var(--prism-button-secondary-shadow-opacity); }
.prism-button--secondary::after { opacity: var(--prism-button-secondary-glint-opacity); }
`
