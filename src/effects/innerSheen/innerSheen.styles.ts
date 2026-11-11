// A soft sheen along the inside of the border of an element with the
// .prism-inner-sheen class, as if the pointer were a light catching the nearest
// edges of the glass.
//
// While the pointer is over the element, the sheen lights the left or right
// edge, whichever half the pointer is in, and the top or bottom edge likewise.
// On an axis's centre line both of that axis's edges light, so dead centre
// lights all four. Along each lit edge the sheen is brightest level with the
// pointer and fades out towards the ends. It fades in on hover only, and only
// for pointers that can hover, so a tap never leaves it stuck on.
//
// The sheen is one inset box-shadow, so it hugs the inner edge and follows the
// host's border-radius and corner-shape: full at the edge, mostly gone by
// --prism-inner-sheen-width in. A mask then reveals it near the pointer, one
// soft ellipse per edge: centred on the edge level with the pointer (top and
// bottom follow --prism-inner-sheen-x, left and right --prism-inner-sheen-y),
// reaching --prism-inner-sheen-size along it, and scaled by that edge's lit
// value. The ellipses fade inward as well as along the edge, so where one
// reaches into a corner it blends into the neighbouring edge rather than cutting
// it off in a hard line.
//
// The sheen is painted into the host's ::after, so the host's own children are
// untouched (no extra :last-child) but its ::after is taken. useInnerSheen.tsx
// writes the pointer position to the host as --prism-inner-sheen-x/y, and which
// edges are lit as --prism-inner-sheen-left/right/top/bottom (0 or 1). They are
// registered as non-inherited and only the ::after inherits them explicitly, so
// a change restyles the host and its sheen rather than everything inside it. The
// ::after transitions the lit values, so an edge fades as the pointer crosses a
// centre line; the host's own transition is left to the host. It fades in and
// out on the shared light timing (--prism-light-fade-in and -out, in
// src/shared/motion.styles.ts), as the glare and the edge light do. The tuning
// properties are registered with inherited defaults, so they can be overridden
// on the element or once on any ancestor. --prism-inner-sheen-intensity is
// applied as the sheen's opacity; its default follows the colour scheme, set on
// :where(:root) so an override anywhere wins.
//
// The host needs a containing block for the sheen; position: relative is applied
// through :where() so any position the host already sets wins.
import { FALLOFF } from '../../shared'

const edgeCentres = {
  top: 'var(--prism-inner-sheen-x) 0',
  bottom: 'var(--prism-inner-sheen-x) 100%',
  left: '0 var(--prism-inner-sheen-y)',
  right: '100% var(--prism-inner-sheen-y)',
}

/**
 * An edge's mask: an ellipse centred on the edge level with the pointer, long
 * along the edge and as deep as the sheen, fading smoothly from a bright core,
 * scaled by the edge's lit value.
 */
function alongEdge(edge: keyof typeof edgeCentres) {
  const along = 'var(--prism-inner-sheen-size)'
  const across = 'var(--depth)'
  const radii = edge === 'top' || edge === 'bottom' ? `${along} ${across}` : `${across} ${along}`
  const stops = FALLOFF.map(([alpha, at]) => `rgb(0 0 0 / calc(var(--prism-inner-sheen-${edge}) * ${alpha})) ${at}%`)
  return `radial-gradient(${radii} at ${edgeCentres[edge]}, ${stops.join(', ')})`
}

export const innerSheenStyles = `
@property --prism-inner-sheen-color {
  syntax: '<color>';
  inherits: true;
  initial-value: #ffffff;
}

@property --prism-inner-sheen-intensity {
  syntax: '<number>';
  inherits: true;
  initial-value: 0.22;
}

@property --prism-inner-sheen-size {
  syntax: '<length>';
  inherits: true;
  initial-value: 180px;
}

@property --prism-inner-sheen-width {
  syntax: '<length>';
  inherits: true;
  initial-value: 24px;
}

@property --prism-inner-sheen-x {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --prism-inner-sheen-y {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --prism-inner-sheen-left {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --prism-inner-sheen-right {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --prism-inner-sheen-top {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --prism-inner-sheen-bottom {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

/* A pale surface has little room left to brighten, so it needs a stronger sheen. */
:where(:root) { --prism-inner-sheen-intensity: 0.4; }

@media (prefers-color-scheme: dark) {
  :where(:root) { --prism-inner-sheen-intensity: 0.22; }
}

:where(.prism-inner-sheen) { position: relative; }

.prism-inner-sheen::after {
  --prism-inner-sheen-x: inherit;
  --prism-inner-sheen-y: inherit;
  --prism-inner-sheen-left: inherit;
  --prism-inner-sheen-right: inherit;
  --prism-inner-sheen-top: inherit;
  --prism-inner-sheen-bottom: inherit;
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  corner-shape: inherit;
  pointer-events: none;
  opacity: 0;
  transition-property:
    opacity,
    --prism-inner-sheen-left,
    --prism-inner-sheen-right,
    --prism-inner-sheen-top,
    --prism-inner-sheen-bottom;
  transition-duration: var(--prism-light-fade-out);
  transition-timing-function: var(--prism-ease-in-out);
  box-shadow:
    inset 0 0 var(--prism-inner-sheen-width) calc(var(--prism-inner-sheen-width) / 2) var(--prism-inner-sheen-color);
  --depth: calc(var(--prism-inner-sheen-width) * 3);
  mask: ${alongEdge('top')}, ${alongEdge('bottom')}, ${alongEdge('left')}, ${alongEdge('right')};
}

@media (hover: hover) {
  .prism-inner-sheen:hover::after {
    opacity: var(--prism-inner-sheen-intensity);
    transition-duration: var(--prism-light-fade-in);
    transition-timing-function: var(--prism-ease-out);
  }
}
`
