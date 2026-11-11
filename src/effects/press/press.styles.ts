// The press shared by Button and VerticalSelector: an element with the
// .prism-press class sinks into the surface while pressed. It shrinks to
// --prism-press-scale, its drop shadow cross-fades to a closer one with a halo
// all the way round, and, with a tint layer, its glass darkens.
//
// It is pressed in `pressedState`: while :active (unless disabled, or
// aria-disabled), or while it has the .prism-press--pressed class, for an
// element pressed through another (VerticalSelector's pill, under the entry
// being pressed). A host with pressed looks of its own appends the same
// selector to its class, so every part of it agrees on when it is pressed.
//
// Every transition takes its timing from the state it heads to, so it sinks in
// quickly (--prism-press-duration, --prism-press-easing) and settles back
// slower (--prism-release-duration, --prism-release-easing), both easing out
// with no overshoot; a press let go part way reverses from wherever it got to.
// The timing in force is --_prism-press-duration and --_prism-press-easing,
// set on the host and inherited by its layers (the leading underscore marks
// them as internal, not tuning properties). A host with transitions of its own
// lists `pressTransition` among them rather than losing the press's timing, and
// a pressed look of its own can take the same timing from the two.
//
// The shadow isn't interpolated from one shadow to the other, which would
// repaint every blurred layer on every frame of the press. The resting and the
// pressed shadow are each drawn on a pseudo-element of .prism-press__shadow (a
// span usePress renders) and cross-fade by opacity, which the browser
// composites without repainting them. The span sits at z-index -1, under the
// content but over the host's own background (the host is isolated, so it
// stays inside it), and an outer shadow never paints under its own box, so
// neither shows through the glass.
//
// The halo gathers evenly all the way round, where the glass meets the
// surface. It is one more layer of the pressed shadow, so it fades in and out
// with the press rather than growing or popping. Its spread is negative, so
// the shadow's edge sits inside the host and only the soft outer half of a
// wide blur shows: light at the edge and fading out. A shadow edge at or
// beyond the host's packs the darkest part of the blur against it, which reads
// as the host growing a couple of pixels.
//
// The tint, .prism-press__tint, is a layer of solid --prism-press-tint over the
// host's background, faded in to --prism-press-tint-opacity. Fading opacity on
// a layer of its own is composited without repainting anything.
//
// scale is its own property, so it never fights a transform set on the host,
// and the browser can run it off the main thread. To do that the browser gives
// the host a compositor layer of its own, which renders it slightly
// differently (Chrome on Windows draws text on a translucent layer with
// greyscale rather than subpixel anti-aliasing, and snaps the layer to the
// pixel grid on its own), and it only drops the layer some time after the
// press. The host would look a hair different after every press, its text
// thinner and an edge shifted, until something repainted it. will-change:
// scale keeps it on its own layer all the time, so it renders the same before,
// during and after a press, and a press needn't make a layer as it starts. A
// layer per host costs a little memory, which is why VerticalSelector's
// entries keep theirs too: a long list is a few small layers, and dropping
// them would bring the shift back to every entry pressed. It also makes the
// host the containing block of any position: fixed element inside it. The
// shrink is left out for prefers-reduced-motion; the shadow and tint still
// fade. Inside a GlassBackdrop the backdrop redraws every frame of the shrink,
// so its glass keeps to the host's edge (see src/components/backdrop).
//
// The tuning properties are set on :where(:root), so they can be overridden on
// the element or once on any ancestor; a component maps its own onto them.

/** Appended to a host's selector: it is pressed. */
export const pressedState = ":is(:active:not(:disabled, [aria-disabled='true']), .prism-press--pressed)"

/** The press's shrink, on its timing, for a host that lists transitions of its own. */
export const pressTransition = 'scale var(--_prism-press-duration) var(--_prism-press-easing)'

export const pressStyles = `
:where(:root) {
  --prism-press-scale: 0.95;
  --prism-press-duration: 120ms;
  --prism-press-easing: var(--prism-ease-out);
  --prism-release-duration: 420ms;
  --prism-release-easing: var(--prism-ease-out-strong);
  --prism-press-rest-shadow:
    0 0 1px rgb(17 19 24 / 0.3),
    0 2px 6px rgb(17 19 24 / 0.18),
    0 8px 20px rgb(17 19 24 / 0.14);
  --prism-press-pressed-shadow:
    0 0 1px rgb(17 19 24 / 0.35),
    0 1px 2px rgb(17 19 24 / 0.2),
    0 2px 6px rgb(17 19 24 / 0.1);
  --prism-press-halo: rgb(17 19 24 / 0.5);
  --prism-press-halo-blur: 32px;
  --prism-press-halo-spread: -8px;
  --prism-press-tint: #111318;
  --prism-press-tint-opacity: 0.12;
}

:where(.prism-press) {
  --_prism-press-duration: var(--prism-release-duration);
  --_prism-press-easing: var(--prism-release-easing);
  position: relative;
  isolation: isolate;
  will-change: scale;
  transition: ${pressTransition};
}

.prism-press${pressedState} {
  --_prism-press-duration: var(--prism-press-duration);
  --_prism-press-easing: var(--prism-press-easing);
}

@media (prefers-reduced-motion: no-preference) {
  .prism-press${pressedState} { scale: var(--prism-press-scale); }
}

.prism-press__shadow,
.prism-press__shadow::before,
.prism-press__shadow::after,
.prism-press__tint {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.prism-press__shadow,
.prism-press__tint { z-index: -1; }

.prism-press__shadow::before,
.prism-press__shadow::after,
.prism-press__tint {
  transition: opacity var(--_prism-press-duration) var(--_prism-press-easing);
}

.prism-press__shadow::before,
.prism-press__shadow::after { content: ''; }

.prism-press__shadow::before { box-shadow: var(--prism-press-rest-shadow); }

.prism-press__shadow::after {
  box-shadow:
    var(--prism-press-pressed-shadow),
    0 0 var(--prism-press-halo-blur) var(--prism-press-halo-spread) var(--prism-press-halo);
  opacity: 0;
}

.prism-press__tint {
  background-color: var(--prism-press-tint);
  opacity: 0;
  will-change: opacity;
}

.prism-press${pressedState} > .prism-press__shadow::before { opacity: 0; }

.prism-press${pressedState} > .prism-press__shadow::after { opacity: 1; }

.prism-press${pressedState} > .prism-press__tint { opacity: var(--prism-press-tint-opacity); }

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-press-rest-shadow:
      0 0 1px rgb(0 0 0 / 0.6),
      0 2px 6px rgb(0 0 0 / 0.4),
      0 8px 20px rgb(0 0 0 / 0.4);
    --prism-press-pressed-shadow:
      0 0 1px rgb(0 0 0 / 0.65),
      0 1px 2px rgb(0 0 0 / 0.45),
      0 2px 6px rgb(0 0 0 / 0.3);
    --prism-press-halo: rgb(0 0 0 / 0.65);
    --prism-press-tint: #000000;
  }
}
`
