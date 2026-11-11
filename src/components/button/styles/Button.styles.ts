// The button's stylesheet, in parts: the glass, layout and press here, and the
// drop shadow (shadow.styles.ts), the state tint (tint.styles.ts), the light
// inside the rim (highlights.styles.ts) and the secondary variant
// (secondary.styles.ts) in files of their own, joined into one sheet in that
// order. The rim itself is the shared rim (src/effects/rim), which ../Button.tsx
// renders with its own sheet.
//
// Buttons take their corner radius from the card's tokens (--prism-card-radius
// and --prism-card-squircle-scale, in the shared corners.styles.ts): the card's
// squircle radius, so it follows any change to the card's. On a button of
// usual height that is more than half the height, which browsers clamp, making
// a pill. The corners are circular arcs rather than squircles: a clamped
// squircle has flat-sided ends with tight bends top and bottom, where a
// clamped arc gives perfectly round ends. On a button tall enough not to clamp,
// the corners come out a little rounder than a card's.
//
// The button is smoky glass: a thin tint over what is behind it, blurred but not
// bent. The blur comes from a GlassBackdrop (see ../Button.tsx),
// with --prism-refraction at 0% so it never bends; both are set on
// :where(.prism-button), so a style on the button overrides them. A faint
// diagonal sheen over the tint and a soft line inside the top edge finish the
// glass.
//
// Of all this only the glare (src/effects/glare) follows the pointer,
// repainting only its own element. It sits at z-index -1, over the tint but
// under the label, so it never washes out the text, and it is inset by the
// rim's width (--prism-glare-inset), so it stops at the rim's inner edge and
// never shows through the translucent rim, while still lining up with the
// pointer exactly. Insetting it costs nothing; a mask would make the browser
// draw a mask layer for it as well.
//
// The shadow, tint and rim spans come after the label in the button, so none
// of them becomes its :first-child; z-index, not their order, sets what paints
// over what.
//
// Pressing pushes the button into the surface: it shrinks to
// --prism-button-press-scale, its drop shadow gives way to a closer one with a
// halo, and its tint, glints and rim follow (see their files). The shrink and
// the shadow are the shared press (src/effects/press), on the button's timing,
// and the tint, glints and rim turn on the press's pressedState and take its
// timing in force, so every part of the button agrees on when it is pressed (an
// aria-disabled button isn't) and sinks in quickly
// (--prism-button-press-duration) and settles back slower
// (--prism-button-release-duration). The press explains the compositor layer
// the shrink keeps; the shrink is left out for prefers-reduced-motion and the
// rest still fades.
//
// The tuning properties are set on :where(:root) rather than on the button, so
// they can be overridden on the button itself or once on any ancestor.
import { highlightStyles } from './highlights.styles'
import { secondaryStyles } from './secondary.styles'
import { shadowStyles } from './shadow.styles'
import { tintStyles } from './tint.styles'

const baseStyles = `
:where(:root) {
  --prism-button-bg: #111318;
  --prism-button-fg: #ffffff;
  /* A faint halo in the text's own colour, smoothing light, thin text on dark
     glass where the browser won't (Windows ignores -webkit-font-smoothing). */
  --prism-button-text-shadow: 0 0 1px color-mix(in srgb, currentColor 35%, transparent);
  --prism-button-glass-opacity: 0.3;
  --prism-button-blur: 10px;
  --prism-button-sheen: linear-gradient(115deg, rgb(255 255 255 / 0.1), transparent 35% 65%, rgb(255 255 255 / 0.06));
  --prism-button-glow: inset 0 1px 1px rgb(255 255 255 / 0.12);
  --prism-button-focus: #6d7cff;
  --prism-button-disabled-opacity: 0.45;
  /* The press's defaults (src/effects/press), kept in one place. */
  --prism-button-press-scale: var(--prism-press-scale);
  --prism-button-press-duration: var(--prism-press-duration);
  --prism-button-press-easing: var(--prism-press-easing);
  --prism-button-release-duration: var(--prism-release-duration);
  --prism-button-release-easing: var(--prism-release-easing);
}

:where(.prism-button) {
  --prism-refraction: 0%;
  --prism-refraction-blur: var(--prism-button-blur);
  /* Dark glass takes more light than the glare's default to show it. */
  --prism-glare-intensity: 0.3;
  --prism-glare-inset: var(--prism-button-rim-width);
  /* The shrink is the shared press's (src/effects/press), on the button's timing. */
  --prism-press-scale: var(--prism-button-press-scale);
  --prism-press-duration: var(--prism-button-press-duration);
  --prism-press-easing: var(--prism-button-press-easing);
  --prism-release-duration: var(--prism-button-release-duration);
  --prism-release-easing: var(--prism-button-release-easing);
}

.prism-button {
  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 20px;
  font: inherit;
  /* Left undeclared, these are invalid, and an invalid inherited property
     inherits: the button keeps its parent's font. */
  font-family: var(--prism-button-font-family);
  font-weight: var(--prism-button-font-weight);
  letter-spacing: var(--prism-button-letter-spacing);
  line-height: 20px;
  /* --_prism-button-fg is the text colour shaded to stay readable, set inline by
     Button.tsx where it must be. Reset here, so a button doesn't inherit one. */
  --_prism-button-fg: initial;
  color: var(--_prism-button-fg, var(--prism-button-fg));
  text-shadow: var(--prism-button-text-shadow);
  background: var(--prism-button-sheen)
    color-mix(in srgb, var(--prism-button-bg) calc(var(--prism-button-glass-opacity) * 100%), transparent);
  border: 0;
  border-radius: calc(var(--prism-card-radius) * var(--prism-card-squircle-scale));
  box-shadow: var(--_prism-button-crescents), var(--prism-button-glow);
  cursor: pointer;
  isolation: isolate;
}

.prism-button > .prism-glare__light { z-index: -1; }

.prism-button:focus-visible {
  outline: 2px solid var(--prism-button-focus);
  outline-offset: 2px;
}

/* Disabled, it lies flat on the surface with its label dimmed, rather than
   fading as a whole: either renderer fades the glass by the button's opacity,
   which would lay half-blurred glass over the sharp page behind it. The glass
   stays whole; the shadow, crescents and glints go and the rim dims. */
.prism-button:disabled {
  color: color-mix(
    in srgb,
    var(--_prism-button-fg, var(--prism-button-fg)) calc(var(--prism-button-disabled-opacity) * 100%),
    transparent
  );
  text-shadow: none;
  box-shadow: none;
  cursor: default;
}

.prism-button:disabled::after,
.prism-button:disabled > .prism-press__shadow { opacity: 0; }

.prism-button:disabled > .prism-rim { opacity: var(--prism-button-disabled-opacity); }

@media (prefers-color-scheme: dark) {
  :where(:root) { --prism-button-focus: #9aa5ff; }
}
`

export const buttonStyles = [baseStyles, shadowStyles, tintStyles, highlightStyles, secondaryStyles].join('')
