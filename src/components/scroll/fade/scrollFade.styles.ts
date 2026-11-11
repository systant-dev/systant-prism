// Fades the content of a scroller with the .prism-scroll-fade class out towards
// each edge it is cut off at, through a mask on the scroller itself.
//
// useScrollFade.tsx writes how far each edge fades as --prism-scroll-fade-top,
// -right, -bottom and -left, 0px where nothing is cut off. They are registered
// as non-inherited, so writing them restyles the scroller alone, not everything
// it scrolls, and a scroller nested in another never picks up its parent's.
// --prism-scroll-fade-size (FADE_SIZE) is how far a fade reaches at most; it is
// registered with an inherited default, so it can be set on the scroller or
// once on any ancestor. The scroller copies it into --prism-scroll-fade, which
// isn't inherited: it is how the WebGPU backdrop (src/components/backdrop) tells
// a fading scroller from any other, to fade the glass it draws behind the
// content too.
//
// The fades run across the padding box, the part content scrolls in, so they
// end where the content is cut off, inside any border or scrollbar. The border
// and scrollbars are kept whole by two more layers: a solid padding box,
// excluded from a solid border box, leaves just the ring outside the padding
// box, which is laid over the fades. Layers composite bottom up:
//   fades:  vertical ∩ horizontal                      = F
//   ring:   border box ⊕ (padding box ⊕ F)             = F ∪ (border box − padding box)
// As with any mask, the scroller's own box-shadow and outline are hidden.
import { fadeEase } from '../../../shared'

/**
 * How far a fade reaches unless told otherwise: the default of both
 * --prism-scroll-fade-size and the data grid's --prism-data-grid-fade, so a
 * scroller fades as deep up and down as the grid's columns do at its sides.
 */
export const FADE_SIZE = '32px'

/**
 * How many straight pieces a fade's curve is drawn in, as a gradient has no
 * curves of its own: at 8, never more than 1.2% of full from fadeEase.
 */
const FADE_STEPS = 8

/** fadeEase at each step in from a cut-off edge: how much shows there, and how far in, both 0–1. */
const fadeStops = Array.from({ length: FADE_STEPS + 1 }, (_, i) => {
  const t = i / FADE_STEPS
  return { t, alpha: `rgb(0 0 0 / ${Number(fadeEase(t).toFixed(4))})` }
})

/**
 * A mask layer that fades what it masks out towards both ends of one axis:
 * down the box ('bottom') or across it ('right'). `start` and `end` are CSS
 * lengths, how far in from the edge it starts at and the one it ends at the
 * fade reaches; 0px leaves that edge whole. It falls off by fadeEase
 * (src/shared/scrollEdges.ts), as the glass behind does, rather than in a
 * straight line, which reads as an abrupt band. Every fade at a cut-off edge
 * is this one, so they all look the same: a scroller's own (below) and the data
 * grid's columns (../../dataGrid/DataGrid.styles.ts).
 */
export function fadeMask(to: 'bottom' | 'right', start: string, end: string) {
  const from = fadeStops.map(({ t, alpha }) => `${alpha} calc(${start} * ${t})`)
  const towards = [...fadeStops].reverse().map(({ t, alpha }) => `${alpha} calc(100% - ${end} * ${t})`)
  return `linear-gradient(to ${to}, ${[...from, ...towards].join(', ')})`
}

export const scrollFadeStyles = `
@property --prism-scroll-fade-size {
  syntax: '<length>';
  inherits: true;
  initial-value: ${FADE_SIZE};
}

@property --prism-scroll-fade {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --prism-scroll-fade-top {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --prism-scroll-fade-right {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --prism-scroll-fade-bottom {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --prism-scroll-fade-left {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

.prism-scroll-fade {
  --prism-scroll-fade: var(--prism-scroll-fade-size);
  mask-image:
    linear-gradient(#000 0 0),
    linear-gradient(#000 0 0),
    ${fadeMask('bottom', 'var(--prism-scroll-fade-top)', 'var(--prism-scroll-fade-bottom)')},
    ${fadeMask('right', 'var(--prism-scroll-fade-left)', 'var(--prism-scroll-fade-right)')};
  mask-origin: border-box, padding-box, padding-box, padding-box;
  mask-clip: border-box, padding-box, padding-box, padding-box;
  mask-repeat: no-repeat;
  mask-composite: exclude, exclude, intersect, add;
}
`
