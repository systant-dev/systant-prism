// The toggle is an on/off switch: a glass capsule, the track, with a round
// glass knob that slides from one end to the other.
//
// The track is a groove in the surface rather than a raised pill: a thin tint
// (-track-bg at -track-opacity) over the refraction of what is behind it, from
// a GlassBackdrop, shaded dark inside its top edge
// (-track-shadow), as if lit from above. Switched on, the fill,
// .prism-toggle__fill (a span Toggle.tsx renders), fades in a tint of -on-bg
// at -on-opacity; fading opacity on a layer of its own is composited without
// repainting. The shading is painted by ::before, over the fill, so it shows
// whether the toggle is on or off.
//
// Its border is the shared rim (src/effects/rim), the button's rim, with the
// button's width and turn: its span comes after the shading, so the rim lies
// over it, and as on a button, pressing turns the rim's light round, and
// letting go turns it back more slowly. Unlike a button's, it is always lit
// softly, from straight above, whether or not it lies on a card, from the
// --prism-toggle-rim-* tokens, which the rim's sheet sets: on a capsule this
// long and low, the raised light's diagonal reads as the track sloping.
//
// The knob, .prism-toggle__knob, is raised clear glass: a faint white tint
// (-knob-bg at -knob-opacity, a little more on hover) under a diagonal sheen
// (-knob-sheen), so the track and its fill show through it, frosted by its own
// refraction (a blur of 2px and a bend of 30%, set on :where() so a style on
// the knob, or on any ancestor, overrides them). Inside its edge are a
// button's crescents of light (-knob-rim), along the top and round the
// top-left, and dimmer along the bottom and round the bottom-right, with a
// hairline ring, over the shared press's drop shadow. It is as tall as the
// track inside its inset, and as wide, so it is round, and slides the rest of
// the track's width (-width less -height) when switched on. The slide is a
// translate transition that eases out with no overshoot (-slide-duration,
// -slide-easing), which the GlassBackdrop follows frame by frame, so its glass
// keeps to the knob's edge throughout (see src/components/backdrop). In text
// that runs right to left it starts on the right and slides left.
//
// Pressing the toggle anywhere shrinks the whole toggle a little, to
// -press-scale, less than a button shrinks, and sinks the knob into the
// surface. Both are the shared press (src/effects/press): the toggle is a press
// of its own, with no shadow, and the knob a press with a shadow and a tint.
// The knob shrinks further, to -knob-press-scale, and darkens a little, while
// its drop shadow (-knob-shadow) gives way to a closer one all the way round
// (-knob-pressed-shadow, -press-halo). The knob takes no pointer events, so
// Toggle.tsx presses both through the press's pressed option, and the rim turns
// with the toggle's press. A knob held down as the toggle switches slides over
// still sunk. The knob lists the press's shrink among its own transitions
// (pressTransition). Both shrink on the press's timing, so they keep in step:
// the GlassBackdrop redraws every frame while the knob's runs, and so keeps
// both lenses to their edges as the toggle shrinks.
//
// While pressed, the knob also stretches towards the end it would slide to,
// by --prism-toggle-knob-stretch, into a capsule, as if gathering itself to
// go: it grows wider, and switched on (at the far end) shifts back by as much,
// so its far edge stays put. Both are on the press's timing, so they keep in
// step with its shrink, which the GlassBackdrop follows frame by frame.
//
// With prefers-reduced-motion the knob jumps rather than sliding, and nothing
// shrinks or stretches on a press; the fill still fades, the shadow still
// changes and the rim still turns.
//
// The tuning properties are set on :where(:root) rather than on the toggle, so
// they can be overridden on the toggle itself or once on any ancestor.
import { pressedState, pressTransition } from '../../effects/press'

const slide = 'var(--prism-toggle-slide-duration) var(--prism-toggle-slide-easing)'

export const toggleStyles = `
:where(:root) {
  --prism-toggle-width: 52px;
  --prism-toggle-height: 32px;
  --prism-toggle-inset: 3px;
  --prism-toggle-track-bg: #f3f4f6;
  --prism-toggle-track-opacity: 0.3;
  --prism-toggle-track-shadow: inset 0 1px 3px rgb(17 19 24 / 0.22);
  --prism-toggle-on-bg: #6d7cff;
  --prism-toggle-on-opacity: 0.75;
  --prism-toggle-knob-bg: #ffffff;
  --prism-toggle-knob-opacity: 0.25;
  --prism-toggle-knob-hover-opacity: 0.35;
  --prism-toggle-knob-sheen: linear-gradient(
    135deg,
    rgb(255 255 255 / 0.35),
    transparent 45% 60%,
    rgb(255 255 255 / 0.15)
  );
  --prism-toggle-knob-rim:
    inset 1px 1.5px 1px -0.5px rgb(255 255 255 / 0.85),
    inset -1px -1px 1px -0.5px rgb(255 255 255 / 0.45),
    0 0 0 0.5px rgb(17 19 24 / 0.12);
  --prism-toggle-knob-shadow:
    0 1px 2px rgb(17 19 24 / 0.2),
    0 3px 8px rgb(17 19 24 / 0.18);
  --prism-toggle-knob-pressed-shadow:
    0 0 1px rgb(17 19 24 / 0.3),
    0 0 6px rgb(17 19 24 / 0.16);
  --prism-toggle-press-halo: rgb(17 19 24 / 0.3);
  --prism-toggle-press-scale: 0.97;
  --prism-toggle-knob-press-scale: 0.9;
  --prism-toggle-knob-stretch: 6px;
  --prism-toggle-slide-duration: 300ms;
  --prism-toggle-slide-easing: var(--prism-ease-out-strong);
  --prism-toggle-focus: #6d7cff;
  --prism-toggle-disabled-opacity: 0.45;
}

:where(.prism-toggle) {
  --prism-refraction: 20%;
  --prism-press-scale: var(--prism-toggle-press-scale);
  --_prism-toggle-direction: 1;
}

:where(.prism-toggle:dir(rtl)) { --_prism-toggle-direction: -1; }

/* The knob's glass and press, with a tighter halo for a knob this small. */
:where(.prism-toggle__knob) {
  --prism-refraction: 30%;
  --prism-refraction-blur: 2px;
  --prism-press-scale: var(--prism-toggle-knob-press-scale);
  --prism-press-rest-shadow: var(--prism-toggle-knob-shadow);
  --prism-press-pressed-shadow: var(--prism-toggle-knob-pressed-shadow);
  --prism-press-halo: var(--prism-toggle-press-halo);
  --prism-press-halo-blur: 12px;
  --prism-press-halo-spread: -3px;
}

.prism-toggle {
  position: relative;
  box-sizing: border-box;
  display: inline-block;
  flex: none;
  width: var(--prism-toggle-width);
  height: var(--prism-toggle-height);
  margin: 0;
  padding: 0;
  vertical-align: middle;
  border: 0;
  border-radius: 9999px;
  background: color-mix(
    in srgb,
    var(--prism-toggle-track-bg) calc(var(--prism-toggle-track-opacity) * 100%),
    transparent
  );
  cursor: pointer;
  isolation: isolate;
  -webkit-tap-highlight-color: transparent;
}

.prism-toggle::before,
.prism-toggle__fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.prism-toggle::before {
  content: '';
  box-shadow: var(--prism-toggle-track-shadow);
}

.prism-toggle__fill {
  z-index: -1;
  background-color: var(--prism-toggle-on-bg);
  opacity: 0;
  will-change: opacity;
  transition: opacity ${slide};
}

.prism-toggle[aria-checked='true'] > .prism-toggle__fill { opacity: var(--prism-toggle-on-opacity); }

.prism-toggle__knob {
  --_prism-toggle-knob-opacity: var(--prism-toggle-knob-opacity);
  position: absolute;
  /* Over the track's shading and rim. */
  z-index: 1;
  top: var(--prism-toggle-inset);
  inset-inline-start: var(--prism-toggle-inset);
  box-sizing: border-box;
  width: calc(var(--prism-toggle-height) - 2 * var(--prism-toggle-inset));
  height: calc(var(--prism-toggle-height) - 2 * var(--prism-toggle-inset));
  border-radius: 9999px;
  background: var(--prism-toggle-knob-sheen)
    color-mix(in srgb, var(--prism-toggle-knob-bg) calc(var(--_prism-toggle-knob-opacity) * 100%), transparent);
  box-shadow: var(--prism-toggle-knob-rim);
  pointer-events: none;
  transition:
    translate ${slide},
    ${pressTransition},
    width var(--_prism-press-duration) var(--_prism-press-easing),
    margin-inline-start var(--_prism-press-duration) var(--_prism-press-easing),
    background-color 200ms var(--prism-ease-out);
}

@media (prefers-reduced-motion: no-preference) {
  .prism-toggle__knob${pressedState} {
    width: calc(var(--prism-toggle-height) - 2 * var(--prism-toggle-inset) + var(--prism-toggle-knob-stretch));
  }

  .prism-toggle[aria-checked='true'] > .prism-toggle__knob${pressedState} {
    margin-inline-start: calc(-1 * var(--prism-toggle-knob-stretch));
  }
}

.prism-toggle[aria-checked='true'] > .prism-toggle__knob {
  translate: calc(var(--_prism-toggle-direction) * (var(--prism-toggle-width) - var(--prism-toggle-height))) 0;
}

@media (hover: hover) {
  .prism-toggle:hover:not(:disabled) > .prism-toggle__knob {
    --_prism-toggle-knob-opacity: var(--prism-toggle-knob-hover-opacity);
  }
}

.prism-toggle:focus-visible {
  outline: 2px solid var(--prism-toggle-focus);
  outline-offset: 2px;
}

/* Disabled, its fill and rim dim and the knob lies flat, rather than the
   whole toggle fading: either renderer fades the glass by its opacity, which
   would lay half-blurred glass over the sharp page behind it. */
.prism-toggle:disabled { cursor: default; }

.prism-toggle:disabled[aria-checked='true'] > .prism-toggle__fill {
  opacity: calc(var(--prism-toggle-on-opacity) * var(--prism-toggle-disabled-opacity));
}

.prism-toggle:disabled > .prism-rim { opacity: var(--prism-toggle-disabled-opacity); }

.prism-toggle:disabled > .prism-toggle__knob > .prism-press__shadow { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .prism-toggle__knob { transition-property: background-color; }
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-toggle-track-bg: #24272e;
    --prism-toggle-track-shadow: inset 0 1px 3px rgb(0 0 0 / 0.45);
    --prism-toggle-knob-opacity: 0.18;
    --prism-toggle-knob-hover-opacity: 0.26;
    --prism-toggle-knob-sheen: linear-gradient(
      135deg,
      rgb(255 255 255 / 0.2),
      transparent 45% 60%,
      rgb(255 255 255 / 0.08)
    );
    --prism-toggle-knob-rim:
      inset 1px 1.5px 1px -0.5px rgb(255 255 255 / 0.6),
      inset -1px -1px 1px -0.5px rgb(255 255 255 / 0.3),
      0 0 0 0.5px rgb(0 0 0 / 0.3);
    --prism-toggle-knob-shadow:
      0 1px 2px rgb(0 0 0 / 0.45),
      0 3px 8px rgb(0 0 0 / 0.4);
    --prism-toggle-knob-pressed-shadow:
      0 0 1px rgb(0 0 0 / 0.5),
      0 0 6px rgb(0 0 0 / 0.3);
    --prism-toggle-press-halo: rgb(0 0 0 / 0.45);
    --prism-toggle-focus: #9aa5ff;
  }
}
`
