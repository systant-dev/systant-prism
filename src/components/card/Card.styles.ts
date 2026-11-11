// Squircle corners via `corner-shape`, with plain border-radius as the fallback.
// The radius tokens live in the shared corners.styles.ts, so buttons match.
//
// The 1px edge is drawn by a ::before overlay rather than a real border, so it
// stays visible when the card clips its content with overflow: hidden. The
// pointer highlight on it is the shared edge light (src/effects/edgeLight),
// which Card.tsx adds; the card's own highlight properties feed it, so
// --prism-card-highlight and --prism-card-highlight-size tune it as before.
//
// The tuning properties are set on :where(:root) rather than on the card, so
// they can be overridden on the card itself or once on any ancestor (a theme
// root, say), and :where() keeps them below any :root rule of the page's own.
//
// Cards tint only part of their surface (--prism-card-bg at
// --prism-card-glass-opacity); the refraction of what is behind them comes from
// a GlassBackdrop. The light comes from above:
// --prism-card-sheen catches it along the top edge only, and the soft shadow
// layers fall slightly below the card, so it reads as raised rather than
// outlined. The tight first layer sits evenly on every side and is what keeps
// the edge defined over busy photos. box-shadow never paints under the box
// itself, so none of it shows through the translucent surface.
//
// Over the tint lie reflected streaks at 45°, for a smoky glass: a broad one
// and two fainter, narrower ones beside it, each ramping in and out rather
// than having a hard edge. They are drawn by their own element,
// .prism-card__streaks, at z-index -1 in the card's stacking context (the card
// is isolated), so over the tint but under the content. Its background is
// fixed to the viewport, so the streaks line up from card to card like one
// light reflecting across several panes, and it is masked to fade down the
// card, away from the light above. --prism-card-stripe-strength scales them (0
// turns them off). The gradient lives on the element rather than in a token,
// so the strength can be overridden on the card itself and still take effect.
// Where an ancestor is transformed, or in iOS Safari, a fixed background
// scrolls with its element, so each card has its own streaks there.
import { paddingStyles } from '../../shared'

const streak = (alpha: number) => `rgb(255 255 255 / calc(${alpha} * var(--prism-card-stripe-strength)))`

const streaks = `repeating-linear-gradient(45deg,
    transparent 0 30px,
    ${streak(0.16)} 80px 130px,
    transparent 180px 200px,
    ${streak(0.08)} 230px 262px,
    transparent 292px 312px,
    ${streak(0.11)} 342px 374px,
    transparent 404px 480px)`

export const cardStyles = `
:where(:root) {
  --prism-card-bg: #f3f4f6;
  --prism-card-fg: #111318;
  --prism-card-border: rgb(17 19 24 / 0.1);
  --prism-card-shadow:
    0 0 1px rgb(17 19 24 / 0.2),
    0 2px 8px rgb(17 19 24 / 0.16),
    0 8px 24px rgb(17 19 24 / 0.16);
  --prism-card-sheen: inset 0 12px 16px -12px rgb(255 255 255 / 0.45);
  --prism-card-highlight: #ffffff;
  --prism-card-glass-opacity: 0.3;
  --prism-card-stripe-strength: 1;
}

.prism-card {
  position: relative;
  box-sizing: border-box;
  /* --_prism-card-fg is the text colour shaded to stay readable, set inline by
     Card.tsx where it must be. Reset here, so a card inside a shaded one
     doesn't inherit its shade. */
  --_prism-card-fg: initial;
  color: var(--_prism-card-fg, var(--prism-card-fg));
  /* No thinner than its page's text needs (--_prism-page-glass, pagePalette.ts). */
  background: color-mix(
    in srgb,
    var(--prism-card-bg) calc(max(var(--prism-card-glass-opacity), var(--_prism-page-glass, 0)) * 100%),
    transparent
  );
  box-shadow: var(--prism-card-shadow), var(--prism-card-sheen);
  border-radius: var(--prism-card-radius);
  isolation: isolate;
}

.prism-card__streaks {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  corner-shape: inherit;
  pointer-events: none;
  background: ${streaks} fixed;
  mask-image: linear-gradient(#000, rgb(0 0 0 / 0.25));
}

:where(.prism-card) {
  --prism-edge-light-color: var(--prism-card-highlight);
  --prism-edge-light-size: var(--prism-card-highlight-size);
  --prism-edge-light-intensity: 1;
}

.prism-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid var(--prism-card-border);
  border-radius: inherit;
  pointer-events: none;
}

@supports (corner-shape: squircle) {
  .prism-card {
    corner-shape: squircle;
    border-radius: calc(var(--prism-card-radius) * var(--prism-card-squircle-scale));
  }

  .prism-card::before { corner-shape: inherit; }
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-card-bg: #24272e;
    --prism-card-fg: #eceef2;
    --prism-card-border: rgb(255 255 255 / 0.1);
    --prism-card-shadow:
      0 0 1px rgb(0 0 0 / 0.6),
      0 2px 8px rgb(0 0 0 / 0.4),
      0 8px 24px rgb(0 0 0 / 0.5);
    --prism-card-sheen: inset 0 12px 16px -12px rgb(255 255 255 / 0.12);
    --prism-card-highlight: rgb(255 255 255 / 0.75);
    --prism-card-stripe-strength: 0.6;
  }
}
${paddingStyles('prism-card')}`
