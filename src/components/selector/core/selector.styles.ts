// What the selectors' stylesheets share, for prism-<orientation>-selector and
// its parts, tuned by that selector's own --prism-<orientation>-selector-*
// properties. Each selector's sheet adds its tokens, its layout and the
// rounding of its entries and pills.
//
// The entries are plain text. Two pills are drawn behind them, the
// __indicator spans. The glass pill stays on the selected entry and glides to
// a newly selected one. The hover pill (__indicator--hover) is the same pill
// without the refraction, faded to -hover-opacity: it glides to whichever
// entry the pointer is over, hides under the glass pill on the selected
// entry, and fades out where it is when the pointer leaves. It has no
// refraction because a dimmed pill would still bend and blur, if more faintly,
// and read as a second glass pill.
//
// The glide is a translate transition that eases out with no overshoot
// (-glide-duration, -glide-easing), so a pill slows into place rather than
// wobbling, and its size along the axis follows the entry's, for entries of
// different sizes. usePillLayout.ts writes the entry's offset and size to the
// pill (-y and -height down, -x and -width across). When a pill appears from
// nowhere (no selection, and the pointer just came in) or something resizes,
// it marks it data-instant for one write, so the pill is placed rather than
// gliding in from wherever it last was.
//
// The hover pill follows the pointer, which crosses entry after entry, so it
// moves on a spring rather than a transition, quicker than the glass pill
// (-hover-glide-duration, about the time it takes to get there). A transition
// retargeted mid-glide starts its curve over, from standing to its fastest at
// once, and the pill surges at every entry; a spring carries its speed on.
// usePillLayout.ts moves it frame by frame, writing where it has got to as the
// internal --_prism-<orientation>-selector-spring-* properties, which go ahead
// of its target while it moves. The entries' labels brighten and dim over the
// same time, so a label lights as the pill reaches it rather than before. The
// hover pill fades in quickly (-hover-fade-in-duration) and out over about
// the length of its glide (-hover-fade-out-duration), easing in, so on its way
// under the glass pill it is still there as it slides beneath rather than
// vanishing halfway. Its fade-in can wait a moment (-hover-delay), so a
// pointer only passing over on its way elsewhere doesn't blink it in and out:
// a pointer leaving before then leaves nothing to fade out.
//
// Mounting as the page first loads, the selector waits for the page to
// settle (useEntrance.ts) with its glass pill hidden and the selected entry's
// label at rest (--waiting), then fades both in (--appearing) after a short
// pause (-appear-delay, -appear-duration), easing in and out. The glass's bend
// starts fading in only once the pill shows, so the two come in together.
//
// A pill's glass is a white tint (-glass at -glass-opacity) with edge lines
// and a hairline ring (-rim), over the press's shadow; the glass pill's
// refraction comes from a GlassBackdrop, at --prism-refraction
// set on :where() so a style on the pill, or on any ancestor, overrides it.
//
// Pressing an entry sinks it into the surface as a button sinks, through the
// shared press (src/effects/press): the entry's label and the pill on it shrink
// a little, by -press-shrink, and the pill darkens (-press-tint) while its drop
// shadow (-shadow) gives way to a closer one all the way round
// (-pressed-shadow, -press-halo). Sinking in and settling back take the press's
// timing (--prism-press-duration, --prism-release-duration), easing out. The
// entries and the pills list scale among their own transitions with the press's
// timing (pressTransition). translate and scale are transitions the
// GlassBackdrop follows frame by frame, so its glass keeps to the pill's edge
// throughout (see src/components/backdrop).
//
// A scale shrinks in proportion to size, so a long entry would lose far more
// than a short one at the same scale. The shrink is a length instead,
// registered so it computes to px, which usePillLayout.ts turns into the scale
// that takes that much off each entry's width, written to the entry, and to
// each pill as the scale of the entry it is on. Until the list is measured, the
// --prism-press-scale each selector sets on itself stands in. Being written
// inline, the measured scale wins over a --prism-press-scale set on the
// selector, so the press is tuned by the shrink. Where @property isn't
// supported the shrink isn't converted to px, so it should then be given in px.
//
// With prefers-reduced-motion the pills jump between entries rather than
// gliding, and nothing shrinks on a press; the pills still fade in and out,
// and their shadow and tint still change.
import { pressTransition } from '../../../effects/press'
import { axes, type Orientation } from './orientation'

export function selectorStyles(orientation: Orientation) {
  const name = `prism-${orientation}-selector`
  const { offsetProperty, sizeProperty, translate } = axes[orientation]
  const glide = `var(--${name}-glide-duration) var(--${name}-glide-easing)`
  const spring = `--_${name}-spring`
  // Eases out about as the spring does, which is 90% there at 60% of the time.
  const follow = `var(--${name}-hover-glide-duration) var(--prism-ease-out)`
  // Fading in eases out, so the pill is there at once; fading out eases in, so
  // a pill sliding under the glass pill stays until it is nearly under it.
  const fadeIn = `var(--${name}-hover-fade-in-duration) var(--prism-ease-out) var(--${name}-hover-delay)`
  const fadeOut = `var(--${name}-hover-fade-out-duration) var(--prism-ease-in)`
  // Easing in and out, as the glass's bend fades in, so neither snaps on.
  const appear = `var(--${name}-appear-duration) var(--prism-ease-in-out) var(--${name}-appear-delay)`
  return `
@property --${name}-press-shrink {
  syntax: '<length>';
  inherits: true;
  initial-value: 4px;
}

:where(.${name}__indicator) {
  --prism-refraction: 30%;
  --prism-refraction-blur: 1px;
  --prism-press-rest-shadow: var(--${name}-shadow);
  --prism-press-pressed-shadow: var(--${name}-pressed-shadow);
  --prism-press-halo: var(--${name}-press-halo);
  --prism-press-tint: var(--${name}-press-tint);
  --prism-press-tint-opacity: var(--${name}-press-tint-opacity);
}

.${name} {
  position: relative;
  gap: var(--${name}-gap);
}

.${name}__option {
  /* Positioned, so it paints over the pills, which come first. */
  position: relative;
  padding: var(--${name}-padding);
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  /* Dimmed no further than its page's text can be and still read (--_prism-page-dimmest, pagePalette.ts). */
  opacity: max(var(--${name}-idle-opacity), var(--_prism-page-dimmest, 0));
  /* On the hover pill's timing, so the label lights as the pill arrives under it. */
  transition:
    opacity ${follow},
    ${pressTransition};
}

.${name}__option[aria-selected='true'],
.${name}__option--hovered {
  opacity: 1;
}

.${name}__option[aria-disabled='true'] {
  cursor: default;
  opacity: calc(var(--${name}-idle-opacity) * 0.5);
}

.${name}__option:focus { outline: none; }

.${name}__option:focus-visible {
  outline: 2px solid var(--${name}-focus);
  outline-offset: -2px;
}

.${name}__indicator {
  position: absolute;
  ${sizeProperty}: var(--${name}-${sizeProperty}, 0px);
  translate: ${translate(`var(--${name}-${offsetProperty}, 0px)`)};
  background: color-mix(
    in srgb,
    var(--${name}-glass) calc(var(--${name}-glass-opacity) * 100%),
    transparent
  );
  box-shadow: var(--${name}-rim);
  pointer-events: none;
  opacity: 0;
  /* Opacity first: data-instant and reduced motion keep only opacity, which takes the first timing. */
  transition:
    opacity 200ms var(--prism-ease-out),
    translate ${glide},
    ${sizeProperty} ${glide},
    ${pressTransition};
}

.${name}__indicator--shown { opacity: 1; }

/* Where its spring has got to, while it moves; it has no transition to glide on. */
.${name}__indicator--hover {
  ${sizeProperty}: var(${spring}-${sizeProperty}, var(--${name}-${sizeProperty}, 0px));
  translate: ${translate(`var(${spring}-${offsetProperty}, var(--${name}-${offsetProperty}, 0px))`)};
  transition:
    opacity ${fadeOut},
    ${pressTransition};
}

.${name}__indicator--hover.${name}__indicator--shown {
  opacity: var(--${name}-hover-opacity);
  transition:
    opacity ${fadeIn},
    ${pressTransition};
}

.${name}__indicator[data-instant] { transition-property: opacity; }

/* Waiting for the page to settle as it loads: the glass pill hidden, its entry at rest. */
.${name}--waiting > .${name}__indicator:not(.${name}__indicator--hover) { opacity: 0; }

.${name}--waiting > .${name}__option[aria-selected='true']:not(.${name}__option--hovered) {
  opacity: max(var(--${name}-idle-opacity), var(--_prism-page-dimmest, 0));
}

.${name}--appearing > .${name}__indicator:not(.${name}__indicator--hover),
.${name}--appearing > .${name}__option[aria-selected='true'] {
  transition: opacity ${appear};
}

@media (prefers-reduced-motion: reduce) {
  .${name}__indicator,
  .${name}__indicator--hover.${name}__indicator--shown { transition-property: opacity; }
}
`
}
