// A popup is a native popover (popover="manual"), so the browser shows it in
// the top layer: over everything on the page, whatever stacking contexts it is
// rendered inside (a card's, say), and positioned against the viewport even
// under a transformed ancestor. Popup.tsx places it with left and top.
//
// It is a card's glass in a button's frame. The tint and text colour are the
// card's, from its own tokens. Inside a GlassBackdrop it is glass like a card,
// but in the top layer, over the page the backdrop draws under, so its glass is
// a canvas of its own, .prism-popup__glass (usePopupGlass.tsx): the image behind
// it, blurred and bent at the edges, hiding the page between. That canvas is
// opaque, so the tint is laid over it again rather than left on the popup,
// underneath, and outside a GlassBackdrop the tint is all there is. A little
// more of the tint covers it (--prism-popup-glass-opacity) and the image is
// blurred a little harder (--prism-popup-blur, which sets the refraction's
// blur), so its content reads over anything. It has no sheen of any kind.
//
// The border is the button's rim, the shared rim (src/effects/rim), a 1px ring
// shaded as if lit from above left, from the button's rim tokens: raised, as a
// rim off a card is, even inside a card, since the popup floats over it, while
// a rim on the popup is soft, as on a card. It never turns, so its gradient is
// painted on a layer the span's size rather than one that can rotate, and it
// takes the popup's squircle corners. Over it lies the card's border light
// (src/effects/edgeLight): the stretch of rim nearest the pointer brightens,
// from the card's --prism-card-highlight and --prism-card-highlight-size, while
// the popup is open.
//
// The corners are the card's: squircles from `corner-shape` at the card's
// scaled-up radius, or plain border-radius at the card's radius where
// unsupported. The drop shadow (--prism-popup-shadow) is deeper than a card's
// or a button's, as it floats over both. Popup.tsx renders the card's
// stylesheet for its tokens, so a theme that restyles cards, or buttons' rims,
// restyles popups with them.
//
// It fades in when shown and out when hidden. Opening starts it transparent
// through @starting-style; closing keeps it displayed and in the top layer
// (display and overlay, allow-discrete) until it has faded. Browsers without
// `overlay` drop it from the top layer at once and fade it where it was. Each
// way takes its timing from the state it heads to, as a Fade does: quick in,
// settling into place, and quicker out, gathering pace.
//
// As it fades it slides --prism-popup-slide, from its anchor as it opens and
// back towards it as it closes, so it reads as coming out of what opened it.
// Popup.tsx marks the side it went on as data-side; opening, it is only placed
// once shown, so Popup.tsx slides it in with an animation of its own, and
// closing slides it here, on the fade's timing. With prefers-reduced-motion it
// only fades.
//
// The tuning properties are set on :where(:root), so they can be overridden on
// the popup itself or once on any ancestor.
import { paddingStyles } from '../../shared'

export const popupStyles = `
/* Registered so it computes to px in whatever unit it is set, for Popup.tsx to read */
@property --prism-popup-slide {
  syntax: '<length>';
  inherits: true;
  initial-value: 4px;
}

:where(:root) {
  --prism-popup-glass-opacity: 0.45;
  --prism-popup-blur: 6px;
  --prism-popup-shadow:
    0 0 1px rgb(17 19 24 / 0.2),
    0 4px 12px rgb(17 19 24 / 0.16),
    0 16px 40px rgb(17 19 24 / 0.24);
  --prism-popup-in-duration: 200ms;
  --prism-popup-in-easing: var(--prism-ease-out);
  --prism-popup-out-duration: 150ms;
  --prism-popup-out-easing: var(--prism-ease-in);
}

:where(.prism-popup) {
  --prism-edge-light-color: var(--prism-card-highlight);
  --prism-edge-light-size: var(--prism-card-highlight-size);
  --prism-edge-light-intensity: 1;
  --prism-refraction-blur: var(--prism-popup-blur);
}

.prism-popup {
  position: fixed;
  inset: auto;
  margin: 0;
  border: 0;
  box-sizing: border-box;
  overflow: visible;
  /* --_prism-popup-fg is the text colour shaded to stay readable, set inline by
     Popup.tsx where it must be. Reset here, so nothing inherits one. */
  --_prism-popup-fg: initial;
  /* No thinner than its page's text needs (--_prism-page-glass, pagePalette.ts). */
  --_prism-popup-tint: color-mix(
    in srgb,
    var(--prism-card-bg) calc(max(var(--prism-popup-glass-opacity), var(--_prism-page-glass, 0)) * 100%),
    transparent
  );
  color: var(--_prism-popup-fg, var(--prism-card-fg));
  background: var(--_prism-popup-tint);
  box-shadow: var(--prism-popup-shadow);
  border-radius: var(--prism-card-radius);
  opacity: 0;
  transition-property: opacity, translate, display, overlay;
  transition-behavior: allow-discrete;
  transition-duration: var(--prism-popup-out-duration);
  transition-timing-function: var(--prism-popup-out-easing);
}

.prism-popup:popover-open {
  opacity: 1;
  transition-duration: var(--prism-popup-in-duration);
  transition-timing-function: var(--prism-popup-in-easing);
}

@starting-style {
  .prism-popup:popover-open { opacity: 0; }
}

.prism-popup__glass {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

.prism-popup__glass > canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.prism-popup__glass::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--_prism-popup-tint);
}

@media (prefers-reduced-motion: no-preference) {
  .prism-popup:not(:popover-open)[data-side='bottom'] { translate: 0 calc(-1 * var(--prism-popup-slide)); }
  .prism-popup:not(:popover-open)[data-side='top'] { translate: 0 var(--prism-popup-slide); }
  .prism-popup:not(:popover-open)[data-side='right'] { translate: calc(-1 * var(--prism-popup-slide)) 0; }
  .prism-popup:not(:popover-open)[data-side='left'] { translate: var(--prism-popup-slide) 0; }
}

@supports (corner-shape: squircle) {
  .prism-popup {
    corner-shape: squircle;
    border-radius: calc(var(--prism-card-radius) * var(--prism-card-squircle-scale));
  }

  .prism-popup__glass { corner-shape: inherit; }
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-popup-shadow:
      0 0 1px rgb(0 0 0 / 0.6),
      0 4px 12px rgb(0 0 0 / 0.4),
      0 16px 40px rgb(0 0 0 / 0.55);
  }
}
${paddingStyles('prism-popup')}`
