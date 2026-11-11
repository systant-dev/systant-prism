// The grid lays its cards out in as many columns of at least
// --prism-card-grid-column as fit, each row as tall as its tallest card, with
// the tray of docked cards above it. With `columns` it has that many, all as
// wide; with `rows`, that many rows, splitting the grid's height evenly but
// never smaller than their cards, and more of the same past them. The grid is the cards' offset parent
// (position: relative), so a card is measured against it whatever its
// translate, and a card on its way out can be pinned where it was, absolutely,
// while the rest close up behind it.
//
// A card moves by translate and scale about its top left, and fades by
// opacity, all transitioning over --prism-card-grid-duration (motion.ts says
// how): moves on --prism-card-grid-easing, which glides, and fades easing out
// as they arrive. One docked fades out where it is as its chip fades in, both
// over the quicker --prism-card-grid-minimise-duration, easing in and out, and
// one brought back from its chip the same way round.
// A card being dragged has no transition of its own while it follows the
// pointer; it is lifted over the others with a deeper shadow, on a layer of its
// own (will-change: translate), so the browser moves it
// without repainting it, and glides into its place on the same timing once let
// go. Each card under it blurs, edges and all, by how much of it it covers,
// up to --prism-card-grid-under-blur, as if seen through it, and sharpens again
// as it moves off or is let go (CardGrid.tsx sets the filter on the card, and
// only while it blurs). Its tint darkens by the same measure, towards
// --prism-card-grid-under-shade, through a layer over its background colour
// that CardGrid.tsx sets nothing on but --prism-card-grid-covered, a number
// registered so it transitions. Both ease to each new amount, quickly while
// the drag goes on, so they keep up with the pointer, and once it is let go
// slowly, in and out, on the lights' fade-out timing, so the cards it leaves
// settle rather than snap back. While any of a card is covered
// its lights go out: the edge light's ring is held off, so it fades as when the
// pointer goes (src/effects/edgeLight), and so is the inner sheen. Its glass
// keeps its blur but stops bending what is behind it (CardGrid.tsx sets its
// --prism-refraction to 0%); uncovered,
// its bend fades back in over --prism-refraction-fade, as when its glass first
// showed.
//
// The grid takes whatever height the CardGrid has under the tray, and never
// less than its cards need: give the CardGrid a min-height rather than a
// height, and put it in a scroller to scroll it. The tray keeps its room while
// empty, so the grid never moves as the first card is docked or the last
// brought back.
// While a card fills the grid it spans every column, and the grid's one row
// stretches to the grid's height; the card's body scrolls what doesn't fit.
// Every other card is hidden, as docked ones are. Maximising goes in two
// steps: the other cards fade out where they are over
// --prism-card-grid-maximise-fade, and only then does the card expand, over
// --prism-card-grid-maximise-duration. Putting it back mirrors that: it
// shrinks over the same, and only then do the others fade back in.
//
// The header is what a card is dragged by: it takes no touch scrolling and its
// text can't be selected. The buttons in it are bare icons, with no glass of their own.
//
// The tray is a horizontal selector's track (src/components/selector) as wide as
// the grid: its glass capsule, drawn by its own stylesheet, with the docked
// cards' chips as its entries, nothing selected, and its hover pill under the
// chip the pointer is over, following it on the selector's spring and fading as
// the selector's does. So it is tuned by the selector's properties
// (--prism-horizontal-selector-track-bg and the rest), set on the grid or the
// tray. A docked card's chip fades in, opening out, and once the card is brought
// back fades out, closing up, by an animation rather than a transition, leaving
// the entry's own transitions as they are; one fading out is kept in the tray,
// inert, until it has. The tray spans the grid and stays while empty, with a
// placeholder at --prism-card-grid-tray-placeholder-opacity saying what it is
// for, dimmed no further on a GlassBackdrop's page than text can be there and
// still read (--_prism-page-dimmest, src/components/backdrop/pagePalette.ts).
//
// When a drag ends the cards spring, by up to --prism-card-grid-spring, over
// --prism-card-grid-spring-duration (motion.ts says how); 0px turns it off.
//
// With prefers-reduced-motion nothing glides, fades or springs: cards go
// straight to their places.
//
// A card's reflected streaks line up from card to card across the grid rather
// than the viewport: a fixed background would ride along with a card as it
// glides, and jump back as it stops. motion.ts says how they hold still.
//
// The tuning properties are set on :where(:root), so they can be overridden on
// the grid or once on any ancestor.
import { paddingStyles } from '../../shared'
import { STREAKS_SIZE } from './motion'

export const cardGridStyles = `
@property --prism-card-grid-covered {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

/* Registered so they compute to px in whatever unit they are set, for useCardDrag.ts and change.ts to read */
@property --prism-card-grid-under-blur {
  syntax: '<length>';
  inherits: true;
  initial-value: 6px;
}

@property --prism-card-grid-spring {
  syntax: '<length>';
  inherits: true;
  initial-value: 6px;
}

:where(:root) {
  --prism-card-grid-column: 280px;
  --prism-card-grid-gap: 16px;
  --prism-card-grid-duration: 350ms;
  --prism-card-grid-easing: var(--prism-ease-out-strong);
  --prism-card-grid-under-shade: rgb(0 0 0 / 0.2);
  --prism-card-grid-spring-duration: 900ms;
  --prism-card-grid-maximise-fade: 150ms;
  --prism-card-grid-maximise-duration: 250ms;
  --prism-card-grid-minimise-duration: 200ms;
  --prism-card-grid-tray-placeholder-opacity: 0.45;
  --prism-card-grid-lifted-shadow:
    0 0 1px rgb(17 19 24 / 0.2),
    0 8px 20px rgb(17 19 24 / 0.22),
    0 24px 48px rgb(17 19 24 / 0.24);
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-card-grid-lifted-shadow:
      0 0 1px rgb(0 0 0 / 0.6),
      0 8px 20px rgb(0 0 0 / 0.5),
      0 24px 48px rgb(0 0 0 / 0.6);
  }
}

@media (prefers-reduced-motion: reduce) {
  :where(:root) {
    --prism-card-grid-duration: 0s;
    --prism-card-grid-spring: 0px;
    --prism-card-grid-maximise-fade: 0s;
    --prism-card-grid-maximise-duration: 0s;
    --prism-card-grid-minimise-duration: 0s;
  }
}

.prism-card-grid {
  --prism-card-grid-cover-duration: var(--prism-light-fade-out);
  --prism-card-grid-cover-easing: var(--prism-ease-in-out);
  display: flex;
  flex-direction: column;
  /* Between the tray and the grid: half the cards' gap, however that is set, unless set itself */
  gap: var(--prism-card-grid-tray-gap, calc(var(--prism-card-grid-gap) / 2));
}

.prism-card-grid__cards {
  position: relative;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(var(--prism-card-grid-column), 100%), 1fr));
  align-content: start;
  gap: var(--prism-card-grid-gap);
}

.prism-card-grid--maximised > .prism-card-grid__cards { align-content: stretch; }

.prism-card-grid--columns > .prism-card-grid__cards {
  grid-template-columns: repeat(var(--prism-card-grid-columns), minmax(0, 1fr));
}

/* Rows share the grid's height, and grow no smaller than their cards need */
.prism-card-grid--rows > .prism-card-grid__cards {
  grid-template-rows: repeat(var(--prism-card-grid-rows), 1fr);
  grid-auto-rows: 1fr;
}

/* Quick while following the pointer, so the cover keeps up with it */
.prism-card-grid--dragging {
  --prism-card-grid-cover-duration: 150ms;
  --prism-card-grid-cover-easing: var(--prism-ease-out);
}

.prism-card-grid__card {
  /* How long it glides for, its streaks too (motion.ts), and how long it fades for, how, and after how long */
  --prism-card-grid-glide-duration: var(--prism-card-grid-duration);
  --prism-card-grid-fade-duration: var(--prism-card-grid-duration);
  --prism-card-grid-fade-easing: var(--prism-ease-out);
  --prism-card-grid-fade-delay: 0s;
  display: flex;
  flex-direction: column;
  min-width: 0;
  transform-origin: 0 0;
  transition:
    translate var(--prism-card-grid-glide-duration) var(--prism-card-grid-easing),
    scale var(--prism-card-grid-glide-duration) var(--prism-card-grid-easing),
    opacity var(--prism-card-grid-fade-duration) var(--prism-card-grid-fade-easing) var(--prism-card-grid-fade-delay),
    --prism-card-grid-covered var(--prism-card-grid-cover-duration) var(--prism-card-grid-cover-easing),
    filter var(--prism-card-grid-cover-duration) var(--prism-card-grid-cover-easing);
}

/* Over the card's own tint, which its background shorthand sets as a colour */
.prism-card.prism-card-grid__card {
  background-image: linear-gradient(
    color-mix(in srgb, var(--prism-card-grid-under-shade) calc(var(--prism-card-grid-covered) * 100%), transparent)
      0 0
  );
}

.prism-card-grid__card--maximised {
  /* Expands quickly, once the others have faded */
  --prism-card-grid-glide-duration: var(--prism-card-grid-maximise-duration);
  grid-column: 1 / -1;
  z-index: 1;
}

/*
 * Changes with timing of their own, which CardGrid.tsx marks the grid with
 * until the next. Putting a maximised card back: it shrinks quickly, and only
 * then do the others fade back in, where they are, as quickly.
 */
.prism-card-grid__cards[data-prism-change='unmaximise'] > .prism-card-grid__card {
  --prism-card-grid-glide-duration: var(--prism-card-grid-maximise-duration);
  --prism-card-grid-fade-duration: var(--prism-card-grid-maximise-fade);
  --prism-card-grid-fade-delay: var(--prism-card-grid-maximise-duration);
}

/* Bringing a card back from its chip: it fades in where it belongs as the chip fades out, as when docked */
.prism-card-grid__cards[data-prism-change='undock'] > .prism-card-grid__card {
  --prism-card-grid-fade-duration: var(--prism-card-grid-minimise-duration);
  --prism-card-grid-fade-easing: var(--prism-ease-in-out);
}

/* Fading out where they are, before one fills the grid (CardGrid.tsx sets it) */
.prism-card-grid__card[data-prism-fading] {
  opacity: 0;
  transition: opacity var(--prism-card-grid-maximise-fade) var(--prism-ease-in);
}

/* Over every row too, where they are set; without, the only row stretches */
.prism-card-grid--rows .prism-card-grid__card--maximised { grid-row: 1 / -1; }

/* Docked: it fades out where it is, quickly, as its chip fades in on the same timing */
.prism-card-grid__card--leaving {
  --prism-card-grid-fade-duration: var(--prism-card-grid-minimise-duration);
  --prism-card-grid-fade-easing: var(--prism-ease-in-out);
  pointer-events: none;
}

.prism-card-grid__card--hidden { display: none !important; }

/* Lined up across the grid rather than fixed to the viewport, by CardGrid.tsx: one image, unrepeated (see motion.ts) */
.prism-card-grid__card > .prism-card__streaks {
  background-attachment: scroll;
  background-size: ${STREAKS_SIZE}px ${STREAKS_SIZE}px;
  background-repeat: no-repeat;
}

.prism-card-grid__card[data-prism-covered] > .prism-edge-light__ring { --prism-light-on: 0; }
.prism-card.prism-card-grid__card[data-prism-covered]::after { opacity: 0; }

.prism-card-grid__card--dragging {
  z-index: 2;
  will-change: translate;
  --prism-card-shadow: var(--prism-card-grid-lifted-shadow);
}

/*
 * The header and body, which keep their own size as the card glides between
 * sizes: motion.ts scales them against the card, about its top left, as the
 * card clips them
 */
.prism-card-grid__content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  transform-origin: 0 0;
}

.prism-card-grid__card--maximised > .prism-card-grid__content { min-height: 0; }

.prism-card-grid__header {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 12px 12px 0 20px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.prism-card-grid__card--dragging .prism-card-grid__header { cursor: grabbing; }
.prism-card-grid--maximised .prism-card-grid__header { cursor: auto; touch-action: auto; }

.prism-card-grid__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  border-radius: 4px;
}

.prism-card-grid__control {
  flex: none;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 5px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  line-height: 0;
  cursor: pointer;
}

/* For screen readers only */
.prism-card-grid__status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.prism-card-grid__control:focus-visible {
  outline: 1.5px solid currentColor;
  outline-offset: 0;
}

.prism-card-grid__body { flex: 1 1 auto; }

.prism-card-grid__card--maximised > .prism-card-grid__content > .prism-card-grid__body {
  min-height: 0;
  overflow: auto;
}

/*
 * The tray, above the grid (DockTray.tsx): a horizontal selector's track, its
 * capsule and all, as wide as the grid and always there. Doubled classes, to
 * win over the selector's sheet in either order.
 */
.prism-horizontal-selector.prism-card-grid__tray {
  /*
   * The chips abut, so the pointer goes straight from one to the next with no
   * bare track between them to put the pill out; their padding takes the gap
   * up instead, leaving their text as far apart
   */
  --prism-horizontal-selector-gap: 0px;
  --prism-horizontal-selector-padding: 8px 20px;
  display: flex;
  align-self: stretch;
  min-width: 0;
  /* The inset is the scroller's, so the pill's shadow has that much room inside it */
  padding: 0;
}

/*
 * The chips, in a scroller of their own inside the capsule, from its start and
 * scrolling sideways past its end: the capsule's rim and glints, which lie over
 * all of it, would scroll away with them. It is rounded as the capsule is, to
 * cut the chips off at its ends, and is what the pill and the chips are placed in.
 */
.prism-card-grid__tray-track {
  position: relative;
  flex: 1;
  display: flex;
  gap: var(--prism-horizontal-selector-gap);
  box-sizing: border-box;
  min-width: 0;
  padding: var(--prism-horizontal-selector-inset);
  overflow-x: auto;
  scrollbar-width: none;
  border-radius: inherit;
}

.prism-card-grid__tray-track::-webkit-scrollbar { display: none; }

/*
 * Faintly, across the track while it is empty, what it is for: crossfading
 * with the first chip to come and the last to go, as it takes no room of theirs
 */
.prism-horizontal-selector__option.prism-card-grid__tray-placeholder {
  position: absolute;
  inset: var(--prism-horizontal-selector-inset);
  display: flex;
  align-items: center;
  padding-block: 0;
  overflow: hidden;
  white-space: nowrap;
  cursor: default;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--prism-card-grid-minimise-duration) var(--prism-ease-in-out);
}

.prism-card-grid__tray--empty .prism-horizontal-selector__option.prism-card-grid__tray-placeholder {
  opacity: max(var(--prism-card-grid-tray-placeholder-opacity), var(--_prism-page-dimmest, 0));
}

/* As tall as a chip and no wider than nothing, gap and all */
.prism-horizontal-selector__option.prism-card-grid__tray-strut {
  flex: none;
  width: 0;
  padding-inline: 0;
  margin-inline-end: calc(-1 * var(--prism-horizontal-selector-gap));
  visibility: hidden;
}

/* An entry of the track, as a button: as wide as its title, up to a point */
.prism-horizontal-selector__option.prism-card-grid__chip {
  flex: none;
  max-width: 240px;
  margin: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: prism-card-grid-chip-in var(--prism-card-grid-minimise-duration) var(--prism-ease-in-out);
}

/* Its card brought back: it fades out where it is in the tray, closing up, as the card fades in */
.prism-horizontal-selector__option.prism-card-grid__chip--leaving {
  pointer-events: none;
  animation: prism-card-grid-chip-out var(--prism-card-grid-minimise-duration) var(--prism-ease-in-out) forwards;
}

/* Opening out as it fades in, so the track grows rather than jumps */
@keyframes prism-card-grid-chip-in {
  from {
    opacity: 0;
    max-width: 0;
    padding-inline: 0;
    margin-inline-end: calc(-1 * var(--prism-horizontal-selector-gap));
  }
}

/* Closing up from how wide it was as it fades out, so the chips after it slide along */
@keyframes prism-card-grid-chip-out {
  from { max-width: var(--prism-card-grid-chip-width, 240px); }
  to {
    opacity: 0;
    max-width: 0;
    padding-inline: 0;
    margin-inline-end: calc(-1 * var(--prism-horizontal-selector-gap));
  }
}
${paddingStyles('prism-card-grid__body')}`
