// The light inside the button's rim. A soft crescent runs along the top and
// round the top-left, and a dimmer one (light bounced back) along the bottom
// and round the bottom-right: two inset shadows on the button offset towards
// the lit sides, so each is widest where it faces the light and tapers to
// nothing round the curve. The browser draws rounded shadows with smooth edges.
// Button.styles.ts lays them under the button's own glow, through
// --_prism-button-crescents, which is set on the button rather than on :root
// so it follows overrides of their colours on the button. The leading
// underscore marks it as internal, not a tuning property.
//
// Just inside the rim at the same two corners is a glint, a soft bevel of light
// as if the glass were thick there: an inset shadow offset towards the corner
// (so it hugs the edges either side of it), painted into ::after and masked to
// a patch round each corner, so it fades out along the top and bottom.
// Pressed (the press's pressedState, src/effects/press), the glints dim to
// --prism-button-press-glint, by opacity, so the fade is composited rather
// than repainted. It keeps the press's timing in force, so it needs no timing
// of its own for each way.
import { pressedState } from '../../../effects/press'

export const highlightStyles = `
:where(:root) {
  --prism-button-highlight: rgb(255 255 255 / 0.8);
  --prism-button-bounce: rgb(255 255 255 / 0.4);
  --prism-button-glint:
    inset 4px 4px 6px -3px rgb(255 255 255 / 0.55),
    inset -4px -4px 6px -3px rgb(255 255 255 / 0.4);
  --prism-button-press-glint: 0.3;
}

.prism-button {
  --_prism-button-crescents:
    inset 1px 1.5px 1px -0.5px var(--prism-button-highlight),
    inset -1px -1px 1px -0.5px var(--prism-button-bounce);
}

.prism-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: var(--prism-button-glint);
  mask:
    radial-gradient(45% 110% at 0 0, #000 30%, transparent 75%),
    radial-gradient(45% 110% at 100% 100%, #000 30%, transparent 75%);
  pointer-events: none;
  transition: opacity var(--_prism-press-duration) var(--_prism-press-easing);
}

.prism-button${pressedState}::after { opacity: var(--prism-button-press-glint); }
`
