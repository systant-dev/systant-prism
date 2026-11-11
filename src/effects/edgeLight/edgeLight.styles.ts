// Light on the edge of an element with the .prism-edge-light class, from the
// page-wide light that follows the pointer (src/shared/lightSource.ts): the
// stretch of edge nearest the pointer brightens, even before the pointer is
// over the element, and the light fades in and out as the pointer comes and
// goes.
//
// The light is drawn by its own element, .prism-edge-light__ring, which
// useEdgeLight.tsx renders inside the host, so the host's ::before and ::after
// stay free. It covers the host, follows its border-radius and corner-shape, and
// paints a radial gradient centred on the light, masked down to a ring
// --prism-edge-light-width wide just inside the host's edge, so it never shows
// through a translucent surface. It inherits the light's position and strength
// (--prism-light-x/y/on, which lightSource.ts writes to the host) explicitly,
// so only the host and the ring restyle as the pointer moves, and it owns the
// fade: in over --prism-light-fade-in and out over --prism-light-fade-out (the
// shared light timing, src/shared/motion.styles.ts), as the glare and the inner
// sheen fade. Which way it is fading is read from the host's --prism-light-on
// by a style query; where those aren't supported it fades both ways over
// -fade-out.
//
// The tuning properties are registered with inherited defaults, so they can be
// overridden on the element or once on any ancestor. --prism-edge-light-size is
// the light's radius on the edge, and also how far from the element the light
// source still lights it (read once, when tracking starts).
export const edgeLightStyles = `
@property --prism-edge-light-color {
  syntax: '<color>';
  inherits: true;
  initial-value: #ffffff;
}

@property --prism-edge-light-intensity {
  syntax: '<number>';
  inherits: true;
  initial-value: 0.9;
}

@property --prism-edge-light-size {
  syntax: '<length>';
  inherits: true;
  initial-value: 120px;
}

@property --prism-edge-light-width {
  syntax: '<length>';
  inherits: true;
  initial-value: 1px;
}

:where(.prism-edge-light) { position: relative; }

.prism-edge-light__ring {
  --prism-light-x: inherit;
  --prism-light-y: inherit;
  --prism-light-on: inherit;
  position: absolute;
  inset: 0;
  border: var(--prism-edge-light-width) solid transparent;
  border-radius: inherit;
  corner-shape: inherit;
  pointer-events: none;
  transition: --prism-light-on var(--prism-light-fade-out) var(--prism-ease-in-out);
  background: radial-gradient(
    var(--prism-edge-light-size) circle at var(--prism-light-x) var(--prism-light-y),
    color-mix(
      in srgb,
      var(--prism-edge-light-color) calc(var(--prism-light-on) * var(--prism-edge-light-intensity) * 100%),
      transparent
    ),
    transparent 100%
  ) border-box;
  mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
}

@container style(--prism-light-on: 1) {
  .prism-edge-light__ring {
    transition-duration: var(--prism-light-fade-in);
    transition-timing-function: var(--prism-ease-out);
  }
}
`
