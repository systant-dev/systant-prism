// The tint the button takes on when hovered, pressed or toggled, kept off the
// rim, which is translucent and would show it. The button's own background
// keeps the resting tint everywhere, rim included (Button.styles.ts), and
// .prism-button__tint (a span ../Button.tsx renders, inset by the rim's width)
// adds the difference inside the rim. It takes its corners from the button's
// own, so it follows a border-radius set on the button.
//
// The span is solid --prism-button-bg, and only its opacity changes: laid over
// the resting tint, an opacity of 1 - (1 - state) / (1 - resting) makes the
// glass inside exactly as dark as the state's opacity alone would. The state's
// opacity is --_prism-button-tint, set on the button by the state rules below;
// the leading underscore marks it as internal, not a tuning property. Fading
// opacity on a layer of its own is composited without repainting anything;
// fading a colour instead would repaint the span every frame.
//
// Its fades keep time with the glare's, from the glare's own
// --prism-glare-fade-in and --prism-glare-fade-out (with the glare's defaults
// should its sheet be absent), and with the press's timing on a press: its
// pressedState (src/effects/press), so an aria-disabled button stays untinted,
// and the timing in force, --_prism-press-duration and --_prism-press-easing. A
// much quicker fade-out than the glare's lightens the glass in a blink while
// the glare is still dimming, which reads as a flicker.
import { pressedState } from '../../../effects/press'

export const tintStyles = `
:where(:root) {
  --prism-button-hover-opacity: 0.4;
  --prism-button-pressed-opacity: 0.55;
}

.prism-button { --_prism-button-tint: var(--prism-button-glass-opacity); }

.prism-button__tint {
  position: absolute;
  z-index: -1;
  inset: var(--prism-button-rim-width);
  border-radius: inherit;
  background-color: var(--prism-button-bg);
  opacity: clamp(0, 1 - (1 - var(--_prism-button-tint)) / (1 - var(--prism-button-glass-opacity)), 1);
  pointer-events: none;
  will-change: opacity;
  transition: opacity var(--prism-glare-fade-out, 600ms) var(--prism-ease-in-out);
}

@media (hover: hover) {
  .prism-button:hover:not(:disabled) { --_prism-button-tint: var(--prism-button-hover-opacity); }

  .prism-button:hover:not(:disabled) > .prism-button__tint {
    transition-duration: var(--prism-glare-fade-in, 250ms);
    transition-timing-function: var(--prism-ease-out);
  }
}

/* :is() takes the specificity of :active:not(:disabled), matching the hover
   rule's, and comes after it, so a toggled button keeps its tint when hovered. */
.prism-button:is([aria-pressed='true'], ${pressedState}) {
  --_prism-button-tint: var(--prism-button-pressed-opacity);
}

.prism-button${pressedState} > .prism-button__tint {
  transition: opacity var(--_prism-press-duration) var(--_prism-press-easing);
}
`
