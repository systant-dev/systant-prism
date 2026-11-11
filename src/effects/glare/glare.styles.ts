// A soft glare on the surface of an element with the .prism-glare class: a pool
// of light under the pointer while it hovers, as if the pointer were a lamp
// reflected in the glass. It fades in on hover only, and only for pointers that
// can hover, so a tap never leaves it stuck on; it fades out more slowly than it
// comes in, staying where the pointer left.
//
// The light is its own element, .prism-glare__light, which useGlare.tsx renders
// inside the host, so the host's ::before and ::after stay free for its own use.
// It fills the host's padding box, less --prism-glare-inset all round (a host
// with an edge of its own, a button's rim, keeps the glare off it), follows its
// border-radius, and paints a radial gradient with a smooth, roughly Gaussian
// falloff out to --prism-glare-size. The gradient is drawn over the whole
// padding box whatever the inset, so it stays centred on the pointer.
//
// useGlare.tsx writes the pointer position to the light itself as
// --prism-glare-x/y, registered as non-inherited, so a pointer move restyles
// and repaints only the light, never the host or its content.
// --prism-glare-intensity is applied as the light's opacity, fading in over
// --prism-glare-fade-in and out over --prism-glare-fade-out, which default to
// the shared light timing (--prism-light-fade-in and -out, in
// src/shared/motion.styles.ts) so it comes and goes with any other light on
// the host; a host that fades something of its own with the glare can use the
// same two. will-change:
// opacity keeps the light on a layer of its own, so a pointer move repaints the
// light alone rather than the whole host, and a fade needn't make or drop a
// layer as it starts and ends.
//
// The tuning properties are registered with inherited defaults, so they can be
// overridden on the element or once on any ancestor. The host needs a
// containing block for the light; position: relative is applied through
// :where() so any position the host already sets wins.
import { FALLOFF } from '../../shared'

const stops = FALLOFF.map(
  ([alpha, at]) => `color-mix(in srgb, var(--prism-glare-color) ${alpha * 100}%, transparent) ${at}%`,
).join(', ')

export const glareStyles = `
@property --prism-glare-color {
  syntax: '<color>';
  inherits: true;
  initial-value: #ffffff;
}

@property --prism-glare-intensity {
  syntax: '<number>';
  inherits: true;
  initial-value: 0.22;
}

@property --prism-glare-size {
  syntax: '<length>';
  inherits: true;
  initial-value: 90px;
}

@property --prism-glare-inset {
  syntax: '<length>';
  inherits: true;
  initial-value: 0px;
}

@property --prism-glare-fade-in {
  syntax: '<time>';
  inherits: true;
  initial-value: 250ms;
}

@property --prism-glare-fade-out {
  syntax: '<time>';
  inherits: true;
  initial-value: 600ms;
}

@property --prism-glare-x {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

@property --prism-glare-y {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

:where(:root) {
  --prism-glare-fade-in: var(--prism-light-fade-in);
  --prism-glare-fade-out: var(--prism-light-fade-out);
}

:where(.prism-glare) { position: relative; }

.prism-glare__light {
  position: absolute;
  inset: var(--prism-glare-inset);
  border-radius: inherit;
  corner-shape: inherit;
  pointer-events: none;
  opacity: 0;
  will-change: opacity;
  transition: opacity var(--prism-glare-fade-out) var(--prism-ease-in-out);
  background: radial-gradient(circle var(--prism-glare-size) at var(--prism-glare-x) var(--prism-glare-y), ${stops})
    calc(-1 * var(--prism-glare-inset)) calc(-1 * var(--prism-glare-inset)) /
    calc(100% + 2 * var(--prism-glare-inset)) calc(100% + 2 * var(--prism-glare-inset)) no-repeat;
}

@media (hover: hover) {
  .prism-glare:hover > .prism-glare__light {
    opacity: var(--prism-glare-intensity);
    transition-duration: var(--prism-glare-fade-in);
    transition-timing-function: var(--prism-ease-out);
  }
}
`
