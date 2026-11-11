// The progress ring is a hoop of clear glass, --prism-progress-thickness wide,
// with a soft patch of colour travelling round inside it.
//
// The glass is the host's lens, drawn by a GlassBackdrop with a hole through it
// (--prism-refraction-hole), which bends what is behind it towards the middle of
// the hoop from both its edges, as thick glass does, and fringes it there. That is
// at its bottom, where it is only faintly blurred, for the page to read through it.
// On the way up the bend eases out as the blur rises to --prism-refraction-frost,
// so the top of the hoop bends nothing and just frosts what is behind it. Over the
// glass lie, in order: a thin tint, ::before, which is a border, so its edges are as
// clean as the browser's own and it leaves the hole clear; the fill, .prism-progress__spin;
// and the light on the glass, on .prism-progress__hole for the inner edge and
// ::after for the outer edge and a broad sheen. The light lying over the fill is
// what puts the fill inside the glass rather than on it.
//
// A hoop's edges are long curves, where the stairs of a hard edge show most, so
// they are very slightly soft, by --prism-progress-edge-soft: the lens fades across
// that width, centred on each edge (--prism-refraction-soft), and the tint and the
// light lie under a blur of a third of it, the Gaussian that spreads as far, so all
// three go soft together. These layers don't change once painted, so the blur costs
// no more than painting them. None of it touches the fill, which is soft already.
//
// The light comes from above, as on a card: a bright crescent along the top of
// the outer edge, where it faces up, and along the bottom of the inner edge,
// where that does. Each edge also has a hairline and a soft glow, the thickness
// of the glass. It is all drawn in white scaled by --prism-progress-light, on
// the element rather than in tokens, so a theme or a GlassBackdrop can scale it
// on any ancestor. The box shadow of .prism-progress__hole falls only outside it,
// on the glass, and its inset shadow only inside it, as the hoop's shadow on what
// is behind the hole. The host's own shadow falls outside the hoop.
//
// The fill is a solid colour shaped by two masks on .prism-progress__spin::before:
// one fades it out along the hoop at both ends, and the other across the hoop
// towards both edges. --prism-progress-arc is its length at half strength, an
// eighth of the way round, and --prism-progress-arc-fade how far each end's fade
// runs either side of that. Both fades follow a raised cosine, each drawn as
// many short stops: a gradient of two is straight, and the eye picks out the
// corners where it starts and stops.
//
// The spin is what has to be smooth, so it is the cheapest thing a browser can
// animate: one layer, painted once, turned at a constant speed by a linear
// `rotate` animation. It runs on the compositor, so nothing on the main thread
// can hold it up (React, a GPU scene's frame being prepared), and it asks nothing
// of the GlassBackdrop, as the glass itself stays still. Its masks are on the
// pseudo-element, so they are flattened into the layer, rather than being applied
// afresh every frame. The fill has no hard edge to shimmer as it turns. It fades
// in quickly over --prism-progress-appear, and so does the glass's bend.
//
// With prefers-reduced-motion it stays at the top and breathes, a slow fade out
// and back: it still says that something is going on, without anything moving.
// In forced colours the tint and light are gone, so the hoop is outlined and the
// fill is the system's highlight colour.
//
// Inside a GlassBackdrop the tint and the light follow the page's glass, dark or
// light (pagePalette), and Progress.tsx sets the fill to the page's text colour
// through --_prism-progress-fill, which the styles prefer. Outside one, the
// tokens follow prefers-color-scheme.
//
// The tuning properties are set on :where(:root) rather than on the ring, so
// they can be overridden on the ring itself or once on any ancestor.

/** How many stops draw each fade. Enough that no corner shows, and few enough to read. */
const STEPS = 10

/** Where a raised cosine is at `t`, 0–1, as a CSS alpha. */
function raisedCosine(t: number) {
  return Number((0.5 - 0.5 * Math.cos(Math.PI * t)).toFixed(4))
}

/** `STEPS + 1` mask stops of a fade, in at `at(0)` up to full by `at(1)`. */
function fade(at: (t: number) => string) {
  const stops: string[] = []
  for (let i = 0; i <= STEPS; i++) stops.push(`rgb(0 0 0 / ${raisedCosine(i / STEPS)}) ${at(i / STEPS)}`)
  return stops
}

const arc = 'var(--prism-progress-arc)'
const arcFade = 'var(--prism-progress-arc-fade)'

/** Along the hoop: starting half a fade before the arc, centred on the top. */
const alongHoop = `conic-gradient(from calc(${arc} / -2 - ${arcFade} / 2),
    ${[
      ...fade((t) => `calc(${arcFade} * ${t})`),
      ...fade((t) => `calc(${arc} + ${arcFade} * ${(1 - t).toFixed(2)})`).reverse(),
    ].join(',\n    ')})`

const soft = 'var(--prism-progress-fill-soft)'
const thickness = 'var(--prism-progress-thickness)'
const edgeSoft = 'var(--prism-progress-edge-soft)'

/** Across the hoop: in from the inner edge, and out to the outer edge. */
const acrossHoop = `radial-gradient(closest-side,
    ${[
      ...fade((t) => `calc(100% - ${thickness} + ${soft} * ${t})`),
      ...fade((t) => `calc(100% - ${soft} * ${t})`).reverse(),
    ].join(',\n    ')})`

const light = (alpha: number) => `rgb(255 255 255 / calc(${alpha} * var(--prism-progress-light)))`

export const progressStyles = `
:where(:root) {
  --prism-progress-size: 120px;
  --prism-progress-thickness: 24px;
  --prism-progress-edge-soft: 1.5px;
  --prism-progress-duration: 1800ms;
  --prism-progress-appear: 150ms;
  --prism-progress-arc: 45deg;
  --prism-progress-arc-fade: 34deg;
  --prism-progress-fill: #111318;
  --prism-progress-fill-opacity: 0.8;
  --prism-progress-fill-soft: 8px;
  --prism-progress-bg: #f3f4f6;
  --prism-progress-glass-opacity: 0.16;
  --prism-progress-light: 1;
  --prism-progress-shadow:
    0 0 1px rgb(17 19 24 / 0.16),
    0 2px 6px rgb(17 19 24 / 0.12),
    0 6px 18px rgb(17 19 24 / 0.12);
  --prism-progress-hole-shadow: inset 0 3px 8px -2px rgb(17 19 24 / 0.22);
}

:where(.prism-progress) {
  --prism-refraction: 26%;
  --prism-refraction-blur: 1px;
  --prism-refraction-frost: 6px;
  --prism-refraction-fade: var(--prism-progress-appear);
}

.prism-progress {
  --prism-refraction-hole: calc(var(--prism-progress-size) / 2 - var(--prism-progress-thickness));
  --prism-refraction-soft: var(--prism-progress-edge-soft);
  position: relative;
  box-sizing: border-box;
  display: inline-block;
  flex: none;
  width: var(--prism-progress-size);
  height: var(--prism-progress-size);
  vertical-align: middle;
  border-radius: 50%;
  box-shadow: var(--prism-progress-shadow);
  isolation: isolate;
}

.prism-progress::before,
.prism-progress::after,
.prism-progress__spin,
.prism-progress__spin::before {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
}

.prism-progress::before,
.prism-progress::after,
.prism-progress__spin::before { content: ''; }

.prism-progress::before,
.prism-progress::after,
.prism-progress__hole { filter: blur(calc(var(--prism-progress-edge-soft) / 3)); }

.prism-progress::before {
  box-sizing: border-box;
  border: ${thickness} solid
    color-mix(in srgb, var(--prism-progress-bg) calc(var(--prism-progress-glass-opacity) * 100%), transparent);
}

.prism-progress__spin {
  will-change: rotate;
  animation:
    prism-progress-spin var(--prism-progress-duration) linear infinite,
    prism-progress-appear var(--prism-progress-appear) var(--prism-ease-out) backwards;
}

.prism-progress__spin::before {
  background: var(--_prism-progress-fill, var(--prism-progress-fill));
  opacity: var(--prism-progress-fill-opacity);
  mask-image: ${alongHoop}, ${acrossHoop};
  mask-composite: intersect;
}

.prism-progress__hole {
  position: absolute;
  inset: ${thickness};
  border-radius: 50%;
  pointer-events: none;
  box-shadow:
    var(--prism-progress-hole-shadow),
    0 1px 1px -0.25px ${light(0.55)},
    0 0 0 0.5px ${light(0.3)},
    0 0 6px ${light(0.16)};
}

.prism-progress::after {
  background: conic-gradient(
    from -70deg,
    transparent,
    ${light(0.2)} 40deg,
    transparent 95deg 180deg,
    ${light(0.1)} 230deg,
    transparent 280deg
  );
  mask-image: radial-gradient(
    closest-side,
    transparent calc(100% - ${thickness} - ${edgeSoft} / 2),
    #000 calc(100% - ${thickness} + ${edgeSoft} / 2) calc(100% - ${edgeSoft} / 2),
    transparent calc(100% + ${edgeSoft} / 2)
  );
  box-shadow:
    inset 0 1.5px 1px -0.5px ${light(0.8)},
    inset 0 -1px 1px -0.5px ${light(0.3)},
    inset 0 0 0 0.5px ${light(0.3)},
    inset 0 0 6px ${light(0.16)};
}

@keyframes prism-progress-spin {
  to { rotate: 1turn; }
}

@keyframes prism-progress-appear {
  from { opacity: 0; }
}

@keyframes prism-progress-breathe {
  to { opacity: 0.3; }
}

@media (prefers-reduced-motion: reduce) {
  .prism-progress__spin {
    will-change: opacity;
    animation: prism-progress-breathe var(--prism-progress-duration) var(--prism-ease-in-out) infinite alternate;
  }
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-progress-fill: #eceef2;
    --prism-progress-bg: #24272e;
    --prism-progress-light: 0.6;
    --prism-progress-shadow:
      0 0 1px rgb(0 0 0 / 0.5),
      0 2px 6px rgb(0 0 0 / 0.3),
      0 6px 18px rgb(0 0 0 / 0.35);
    --prism-progress-hole-shadow: inset 0 3px 8px -2px rgb(0 0 0 / 0.4);
  }
}

@media (forced-colors: active) {
  .prism-progress::before { border-color: Canvas; }

  .prism-progress::after,
  .prism-progress__hole {
    outline: 1px solid CanvasText;
    filter: none;
  }

  .prism-progress::after { background: none; }

  .prism-progress__spin::before {
    forced-color-adjust: none;
    background: Highlight;
    opacity: 1;
  }
}
`
