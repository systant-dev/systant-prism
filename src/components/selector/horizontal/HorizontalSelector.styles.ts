// The horizontal selector is one glass pill, the track, with its entries in a
// row inside it as plain text. What it shares with the vertical selector (the
// two pills behind the entries, the slide, the press and its shrink, the pills'
// glass) is src/components/selector/core/selector.styles.ts, tuned by the
// tokens here.
//
// The track is glass like a card: a thin tint (-track-bg at -track-opacity), a
// light line inside its top edge and a soft drop shadow, over the refraction of
// what is behind it from a GlassBackdrop.
//
// Its edge is shaded like a button's (src/components/button), but lit from
// above right where the button is lit from above left, so the two don't repeat
// each other side by side. The rim, a ring -track-rim-width wide painted by
// ::before and masked down to the ring, is bright round the top-right, dark
// across the top-left, bright again (a little less) round the bottom-left and
// dark, but less so, across the bottom-right, over the drop shadow. Where the
// button's rim is a conic gradient round its centre, the track's lights are
// ellipses pinned to its corners and sized by its width and height: a track is
// often much wider than a button, and round its centre the ends would get only
// a sliver of the turn. Inside the rim are the button's two crescents of light,
// along the top and round the right, and dimmer along the bottom and round the
// left, as inset shadows offset towards those sides, and a glint just inside at
// each of the two lit corners, painted into ::after and masked to a patch round
// each. ::after sits at z-index -1 in the track, which isolates itself, so the
// glints are under the pills and entries.
//
// Its corners are as round as they go, so it is a capsule whatever its
// height, and the lens follows them (it clamps the radius to half the shorter
// side, as browsers do). It is as wide as its entries, and never narrower;
// given a width, the entries share what is spare.
//
// The pills follow the entry's width, for entries of different lengths, and
// span the track's height inside its padding (-inset), the gap between the
// track's edge and theirs. They are capsules too, brighter than the track.
//
// A row is short, and a pointer crossing the page crosses it often, inside it
// for only a few tens of milliseconds. The hover pill waits that long
// (-hover-delay) before fading in, so a pointer passing over doesn't blink it.
//
// The tuning properties are set on :where(:root) rather than on the selector,
// so they can be overridden on the selector itself or once on any ancestor.
import { selectorStyles } from '../core'

export const horizontalSelectorStyles = `
:where(:root) {
  --prism-horizontal-selector-track-bg: #f3f4f6;
  --prism-horizontal-selector-fg: #111318;
  --prism-horizontal-selector-track-opacity: 0.3;
  --prism-horizontal-selector-track-rim-light: rgb(255 255 255 / 0.85);
  --prism-horizontal-selector-track-rim-shade: rgb(17 19 24 / 0.22);
  --prism-horizontal-selector-track-rim-shade-bottom: rgb(17 19 24 / 0.12);
  --prism-horizontal-selector-track-rim-bounce: rgb(255 255 255 / 0.6);
  --prism-horizontal-selector-track-rim-width: 1px;
  --prism-horizontal-selector-track-highlight: rgb(255 255 255 / 0.7);
  --prism-horizontal-selector-track-bounce: rgb(255 255 255 / 0.35);
  --prism-horizontal-selector-track-glint:
    inset -4px 4px 6px -3px rgb(255 255 255 / 0.5),
    inset 4px -4px 6px -3px rgb(255 255 255 / 0.35);
  --prism-horizontal-selector-track-shadow:
    0 0 1px rgb(17 19 24 / 0.2),
    0 2px 8px rgb(17 19 24 / 0.16),
    0 8px 24px rgb(17 19 24 / 0.16);
  --prism-horizontal-selector-track-sheen: inset 0 12px 16px -12px rgb(255 255 255 / 0.45);
  --prism-horizontal-selector-inset: 4px;
  --prism-horizontal-selector-gap: 4px;
  --prism-horizontal-selector-padding: 8px 18px;
  --prism-horizontal-selector-idle-opacity: 0.8;
  --prism-horizontal-selector-glass: #ffffff;
  --prism-horizontal-selector-glass-opacity: 0.45;
  --prism-horizontal-selector-hover-opacity: 0.45;
  --prism-horizontal-selector-rim:
    inset 0 1px 0 rgb(255 255 255 / 0.6),
    inset 0 -1px 0 rgb(255 255 255 / 0.15),
    0 0 0 1px rgb(255 255 255 / 0.2);
  --prism-horizontal-selector-shadow: 0 2px 10px rgb(0 0 0 / 0.14);
  --prism-horizontal-selector-pressed-shadow:
    0 0 1px rgb(0 0 0 / 0.25),
    0 0 8px rgb(0 0 0 / 0.16);
  --prism-horizontal-selector-press-halo: rgb(0 0 0 / 0.25);
  --prism-horizontal-selector-press-tint: #000000;
  --prism-horizontal-selector-press-tint-opacity: 0.08;
  --prism-horizontal-selector-glide-duration: 400ms;
  --prism-horizontal-selector-glide-easing: var(--prism-ease-out-strong);
  --prism-horizontal-selector-hover-glide-duration: 300ms;
  --prism-horizontal-selector-hover-fade-in-duration: 180ms;
  --prism-horizontal-selector-hover-fade-out-duration: 280ms;
  --prism-horizontal-selector-hover-delay: 70ms;
  --prism-horizontal-selector-appear-delay: 120ms;
  --prism-horizontal-selector-appear-duration: 450ms;
  --prism-horizontal-selector-focus: #6d7cff;
}

/* The track's bend, and the press's scale until the entries are measured. */
:where(.prism-horizontal-selector) {
  --prism-refraction: 20%;
  --prism-press-scale: 0.96;
}

/* A tighter halo, for pills as short as the track. */
:where(.prism-horizontal-selector__indicator) {
  --prism-press-halo-blur: 16px;
  --prism-press-halo-spread: -4px;
}
${selectorStyles('horizontal')}
.prism-horizontal-selector {
  display: inline-flex;
  box-sizing: border-box;
  min-width: max-content;
  padding: var(--prism-horizontal-selector-inset);
  border-radius: 9999px;
  /* --_prism-horizontal-selector-fg is the text colour shaded to stay readable,
     set inline by the selector where it must be. Reset here, so nothing inherits one. */
  --_prism-horizontal-selector-fg: initial;
  color: var(--_prism-horizontal-selector-fg, var(--prism-horizontal-selector-fg));
  background: color-mix(
    in srgb,
    var(--prism-horizontal-selector-track-bg)
      calc(max(var(--prism-horizontal-selector-track-opacity), var(--_prism-page-glass, 0)) * 100%),
    transparent
  );
  box-shadow:
    inset -1px 1.5px 1px -0.5px var(--prism-horizontal-selector-track-highlight),
    inset 1px -1px 1px -0.5px var(--prism-horizontal-selector-track-bounce),
    var(--prism-horizontal-selector-track-sheen),
    var(--prism-horizontal-selector-track-shadow);
  isolation: isolate;
}

.prism-horizontal-selector::before,
.prism-horizontal-selector::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.prism-horizontal-selector::before {
  box-sizing: border-box;
  padding: var(--prism-horizontal-selector-track-rim-width);
  background:
    radial-gradient(60% 120% at 100% 0, var(--prism-horizontal-selector-track-rim-light), transparent),
    radial-gradient(50% 120% at 0 100%, var(--prism-horizontal-selector-track-rim-bounce), transparent),
    linear-gradient(
      var(--prism-horizontal-selector-track-rim-shade),
      var(--prism-horizontal-selector-track-rim-shade-bottom)
    );
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
}

.prism-horizontal-selector::after {
  z-index: -1;
  box-shadow: var(--prism-horizontal-selector-track-glint);
  mask:
    radial-gradient(64px 110% at 100% 0, #000 30%, transparent 75%),
    radial-gradient(64px 110% at 0 100%, #000 30%, transparent 75%);
}

.prism-horizontal-selector__option {
  flex: 1 1 auto;
  border-radius: 9999px;
  text-align: center;
  white-space: nowrap;
}

.prism-horizontal-selector__indicator {
  top: var(--prism-horizontal-selector-inset);
  bottom: var(--prism-horizontal-selector-inset);
  left: 0;
  border-radius: 9999px;
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-horizontal-selector-track-bg: #24272e;
    --prism-horizontal-selector-fg: #eceef2;
    --prism-horizontal-selector-track-rim-light: rgb(255 255 255 / 0.6);
    --prism-horizontal-selector-track-rim-shade: rgb(0 0 0 / 0.45);
    --prism-horizontal-selector-track-rim-shade-bottom: rgb(0 0 0 / 0.25);
    --prism-horizontal-selector-track-rim-bounce: rgb(255 255 255 / 0.35);
    --prism-horizontal-selector-track-highlight: rgb(255 255 255 / 0.3);
    --prism-horizontal-selector-track-bounce: rgb(255 255 255 / 0.15);
    --prism-horizontal-selector-track-glint:
      inset -4px 4px 6px -3px rgb(255 255 255 / 0.22),
      inset 4px -4px 6px -3px rgb(255 255 255 / 0.14);
    --prism-horizontal-selector-track-shadow:
      0 0 1px rgb(0 0 0 / 0.6),
      0 2px 8px rgb(0 0 0 / 0.4),
      0 8px 24px rgb(0 0 0 / 0.5);
    --prism-horizontal-selector-track-sheen: inset 0 12px 16px -12px rgb(255 255 255 / 0.12);
    --prism-horizontal-selector-glass-opacity: 0.16;
  }
}
`
