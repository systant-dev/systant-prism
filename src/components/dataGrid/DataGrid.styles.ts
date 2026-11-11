// A data grid is a Card (padding none) holding a view: the table, which is
// the header over the scrolling body, and the footer under it. A child grid is
// a view on its own inside a row's detail, framed by a hairline rather than a
// second pane of glass.
//
// Every row is a CSS grid of three lanes, worked out by GridView.tsx into
// --_prism-data-grid-tracks: the expander, the columns and the actions (either
// side 0px where there is none). The columns are a grid of their own,
// .prism-data-grid__cells, on --_prism-data-grid-cells: a share of the width for
// each but never less than --prism-data-grid-column-min, but for one with a
// width of its own, asked for, dragged or fitted (columnWidths.ts), which is
// that wide whatever the grid's. --_prism-data-grid-least is the sum of the
// least widths, which the rows never go under, so a narrow grid scrolls
// sideways; the header and summary row lie outside it to stay in view, and
// their columns move with it (see below). Columns that all have widths, and
// come to less than the grid's, leave the rest of it empty after them.
//
// A header holds the handle its column is resized by (ColumnResizer.tsx) across
// its far edge, half over the next column's: nothing to see but a hairline as
// the pointer comes over the header, as the grid has no lines between its
// columns. The last column's is cut off at the window's edge, and is half as
// wide to catch.
//
// As the grid scrolls sideways, the expander and actions lanes stick to its
// sides, and only the columns move, between them. The grid is glass, so the
// lanes can't hide what passes under them; instead each row's columns lie in a
// window between the lanes (.prism-data-grid__cells), which clips them, and
// within it on a track (.prism-data-grid__track) that moves as the body
// scrolls. In the body the window sticks between the lanes as the row scrolls,
// and the track moves back by as much; in the header and summary row, which
// don't scroll, the track moves alone.
//
// Nothing of it is moved by script. The body's scroll is a scroll timeline,
// named per grid (--_prism-data-grid-timeline, from GridView.tsx) and scoped to
// the table so the header and summary row reach it, and the track is an
// animation on it from where it rests to as far as the body scrolls. So the
// browser moves the columns in the same frame as the scroll, sticky lanes,
// window and all, rather than a script a frame after, which jitters. A browser
// without scroll timelines has the track moved by --_prism-data-grid-scroll,
// which GridView.tsx writes as the body scrolls.
//
// Where there is more to scroll to, the columns fade out over
// --prism-data-grid-fade (FADE_SIZE, as far as any scroller fades) towards that
// lane, by a mask on the window, which doesn't move, as far as GridView.tsx
// measures the body's fade (--_prism-data-grid-fade-left and -right). The mask is the one a scroller
// fades by (fadeMask, in ../scroll/fade/scrollFade.styles.ts), as the body's
// own fade still fades the rows at its top and bottom, but not at its sides,
// where it would fade the lanes too.
//
// The body's rows are laid at their offsets (VirtualRows.tsx) in a box as tall
// as them all. Lines, hover and the detail's tint are the text colour mixed
// with nothing, so they follow the glass's readable text colour, dark or light.
//
// The tuning properties are on :where(:root), as a card's are, so they can be
// set on the grid or once on any ancestor.
import { FADE_SIZE, fadeMask } from '../scroll'

export const dataGridStyles = `
:where(:root) {
  --prism-data-grid-height: 480px;
  --prism-data-grid-column-min: 120px;
  --prism-data-grid-expander-width: 44px;
  --prism-data-grid-actions-width: 84px;
  --prism-data-grid-cell-padding: 12px;
  --prism-data-grid-fade: ${FADE_SIZE};
  --prism-data-grid-line: color-mix(in srgb, currentColor 14%, transparent);
  --prism-data-grid-hover: color-mix(in srgb, currentColor 6%, transparent);
  --prism-data-grid-detail-bg: color-mix(in srgb, currentColor 4%, transparent);
  --prism-data-grid-error: #c62f2f;
  --prism-data-grid-focus: #6d7cff;
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-data-grid-error: #ff8a8a;
    --prism-data-grid-focus: #9aa5ff;
  }
}

.prism-data-grid {
  display: flex;
  flex-direction: column;
  height: var(--prism-data-grid-height);
  min-width: 0;
}

.prism-data-grid__view,
.prism-data-grid__table {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

/* Until GridView.tsx measures them; and so a child grid never takes its parent's. */
.prism-data-grid__table {
  --_prism-data-grid-scroll: 0px;
  --_prism-data-grid-width: 100vw;
  --_prism-data-grid-fade-left: 0px;
  --_prism-data-grid-fade-right: 0px;
  /* The window between the lanes, and how far the body scrolls sideways. */
  --_prism-data-grid-window: calc(
    var(--_prism-data-grid-width) - var(--_prism-data-grid-start) - var(--_prism-data-grid-end)
  );
  --_prism-data-grid-reach: max(0px, calc(var(--_prism-data-grid-least) - var(--_prism-data-grid-width)));
}

/* Clipped rather than hidden, so neither is a scroller that focus could scroll out of step. */
.prism-data-grid__head,
.prism-data-grid__foot {
  flex: none;
  overflow: clip;
}

/* As wide as the grid, not the columns: only their tracks move. */
.prism-data-grid__head > .prism-data-grid__row,
.prism-data-grid__foot > .prism-data-grid__row {
  min-width: 0;
}

.prism-data-grid__cells {
  grid-column: 2;
  display: flex;
  align-self: stretch;
  min-width: 0;
  overflow: clip;
  mask-image: ${fadeMask('right', 'var(--_prism-data-grid-fade-left)', 'var(--_prism-data-grid-fade-right)')};
}

/* A body row is as wide as all its columns and scrolls, so its window sticks between the lanes. */
.prism-data-grid__rows > .prism-data-grid__row > .prism-data-grid__cells {
  position: sticky;
  inset-inline-start: var(--_prism-data-grid-start);
  justify-self: start;
  width: var(--_prism-data-grid-window);
}

.prism-data-grid__track {
  position: relative;
  display: grid;
  grid-template-columns: var(--_prism-data-grid-cells);
  align-items: center;
  flex: none;
  width: max(100%, var(--_prism-data-grid-cells-least));
}

@keyframes prism-data-grid-scroll {
  to { transform: translateX(calc(-1 * var(--_prism-data-grid-reach))); }
}

@supports (animation-timeline: scroll()) and (timeline-scope: none) {
  .prism-data-grid__table { timeline-scope: var(--_prism-data-grid-timeline); }
  .prism-data-grid__body > .prism-scroll-area__viewport { scroll-timeline: var(--_prism-data-grid-timeline) x; }
  .prism-data-grid__track {
    animation: prism-data-grid-scroll linear both;
    animation-timeline: var(--_prism-data-grid-timeline);
  }
}

@supports not ((animation-timeline: scroll()) and (timeline-scope: none)) {
  .prism-data-grid__track { transform: translateX(calc(-1 * var(--_prism-data-grid-scroll))); }
}

/* In a body row, they stick to the sides as it scrolls. */
.prism-data-grid__rows > .prism-data-grid__row > .prism-data-grid__lane {
  position: sticky;
  z-index: 1;
}

/* Each in its own track, whichever are there: without an expander, the columns still take the second. */
.prism-data-grid__lane--start { grid-column: 1; inset-inline-start: 0; }
.prism-data-grid__lane--end { grid-column: 3; inset-inline-end: 0; }

/* The header's end lane holds the button that clears the filters: at its foot, level with them (10px under the 32px filters, the button 30px). */
.prism-data-grid__head .prism-data-grid__lane--end {
  align-self: stretch;
  align-items: flex-end;
  box-sizing: border-box;
  padding-block-end: 11px;
}

/* Doubled up to outrank .prism-data-grid__row, which comes later. */
.prism-data-grid__row.prism-data-grid__row--summary {
  min-height: 40px;
  border-top: 1px solid var(--prism-data-grid-line);
  border-bottom: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.prism-data-grid__row--summary .prism-data-grid__track > .prism-data-grid__cell--end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-block: 6px;
}

.prism-data-grid__summary-label,
.prism-data-grid__summary-value {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prism-data-grid__summary-label {
  font-size: 0.75em;
  font-weight: 400;
  line-height: 1.2;
  opacity: 0.7;
}

.prism-data-grid__body {
  flex: 1;
  --prism-scroll-fade-size: var(--prism-data-grid-fade);
}

/* Its fade at the sides would fade the lanes too; the columns' own mask fades them there instead.
   The ScrollArea writes these inline as it scrolls, which only !important outranks. */
.prism-data-grid__body > .prism-scroll-area__viewport {
  --prism-scroll-fade-left: 0px !important;
  --prism-scroll-fade-right: 0px !important;
  /* Focus scrolls a cell into the window, clear of the lanes. */
  scroll-padding-inline: var(--_prism-data-grid-start) var(--_prism-data-grid-end);
}

.prism-data-grid__rows {
  position: relative;
  min-width: var(--_prism-data-grid-least);
}

.prism-data-grid__rows > * {
  position: absolute;
  inset-inline: 0;
}

.prism-data-grid__row {
  display: grid;
  grid-template-columns: var(--_prism-data-grid-tracks);
  align-items: center;
  box-sizing: border-box;
  min-width: var(--_prism-data-grid-least);
  border-bottom: 1px solid var(--prism-data-grid-line);
}

.prism-data-grid__rows > .prism-data-grid__row:hover { background: var(--prism-data-grid-hover); }

.prism-data-grid__cell {
  min-width: 0;
  padding-inline: var(--prism-data-grid-cell-padding);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prism-data-grid__cell--end {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.prism-data-grid__cell--checkbox {
  display: flex;
  align-items: center;
}

.prism-data-grid__cell--control {
  display: flex;
  justify-content: center;
  padding-inline: 0;
  overflow: visible;
}

.prism-data-grid__cell--actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  padding-inline: 8px;
  overflow: visible;
}

.prism-data-grid__row--editing { background: var(--prism-data-grid-hover); }

.prism-data-grid__row--editing .prism-data-grid__cell {
  overflow: visible;
  padding-inline: 4px;
}

.prism-data-grid__header {
  position: relative;
  display: flex;
  flex-direction: column;
  /* As tall as the row, for its resizer, with its text at the top: so a header without a filter lines up with those with one. */
  align-self: stretch;
  gap: 6px;
  padding-block: 10px;
  overflow: visible;
}

/* Over the next header's padding, which comes after it. */
.prism-data-grid__resizer {
  position: absolute;
  inset-block: 0;
  inset-inline-end: -5px;
  z-index: 1;
  width: 11px;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
}

/* The hairline, in the column's last px. */
.prism-data-grid__resizer::after {
  content: '';
  position: absolute;
  inset-block: 8px;
  inset-inline-end: 5px;
  width: 1px;
  border-radius: 1px;
  background: currentColor;
  opacity: 0;
  transition: opacity 150ms;
}

.prism-data-grid__head:hover .prism-data-grid__resizer::after { opacity: 0.14; }
.prism-data-grid__head .prism-data-grid__resizer:hover::after,
.prism-data-grid__head .prism-data-grid__resizer[data-dragging]::after { opacity: 0.5; }

.prism-data-grid__resizer:focus-visible { outline: none; }
.prism-data-grid__head .prism-data-grid__resizer:focus-visible::after {
  inset-inline-end: 4px;
  width: 3px;
  background: var(--prism-data-grid-focus);
  opacity: 1;
}

.prism-data-grid__sort {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
}

.prism-data-grid__cell--end .prism-data-grid__sort { flex-direction: row-reverse; }

.prism-data-grid__header-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.prism-data-grid__sort svg {
  flex: none;
  opacity: 0;
  transition: opacity 150ms, rotate 150ms;
}

.prism-data-grid__sort:hover svg { opacity: 0.4; }
.prism-data-grid__sort--ascending svg,
.prism-data-grid__sort--descending svg { opacity: 1; }
.prism-data-grid__sort--descending svg { rotate: 180deg; }

/* Within a header too, so a range calendar's own width (.prism-calendar--range), which may come later, doesn't win. */
.prism-data-grid__field,
.prism-data-grid__header .prism-data-grid__field {
  --prism-textbox-width: 100%;
  --prism-textbox-height: 32px;
  --prism-textbox-padding: 12px;
}

.prism-data-grid__choice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 5px 10px 5px 14px;
}

.prism-data-grid__choice-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prism-data-grid__choice svg { flex: none; }

.prism-data-grid__icon-button {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  transition: opacity 150ms, background-color 150ms;
}

.prism-data-grid__icon-button:hover:not(:disabled) {
  opacity: 1;
  background: var(--prism-data-grid-hover);
}

/* The button that deletes a row once asked, in the colour of a warning. */
.prism-data-grid__icon-button--danger {
  color: var(--prism-data-grid-error);
  opacity: 1;
}

.prism-data-grid__icon-button:disabled {
  opacity: 0.3;
  cursor: default;
}

.prism-data-grid__sort:focus-visible,
.prism-data-grid__viewport:focus-visible,
.prism-data-grid__icon-button:focus-visible {
  outline: 2px solid var(--prism-data-grid-focus);
  outline-offset: 2px;
}

/* Inside the body's edge, which the card would cut an outer ring off at. */
.prism-data-grid__viewport:focus-visible { outline-offset: -2px; }

.prism-data-grid__expander svg { transition: rotate 150ms; }
.prism-data-grid__expander[aria-expanded='true'] svg { rotate: 90deg; }
.prism-data-grid__expander:dir(rtl) svg { scale: -1 1; }

.prism-data-grid__detail {
  display: flex;
  box-sizing: border-box;
  min-width: var(--_prism-data-grid-least);
  padding: 8px var(--prism-data-grid-cell-padding) 12px var(--prism-data-grid-expander-width);
  background: var(--prism-data-grid-detail-bg);
  border-bottom: 1px solid var(--prism-data-grid-line);
}

/* It stays in view as the columns above and below it scroll sideways, after the expander lane and as wide as the window. */
.prism-data-grid__detail-cell {
  position: sticky;
  inset-inline-start: var(--_prism-data-grid-start);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  flex: none;
  box-sizing: border-box;
  width: calc(var(--_prism-data-grid-width) - var(--_prism-data-grid-start) - var(--prism-data-grid-cell-padding));
  min-width: 0;
}

.prism-data-grid__detail-cell > .prism-data-grid__view {
  align-self: stretch;
  border: 1px solid var(--prism-data-grid-line);
  border-radius: 12px;
}

.prism-data-grid__detail-title { font-weight: 600; }

.prism-data-grid__message {
  display: grid;
  place-items: center;
  padding: 32px;
  opacity: 0.75;
}

.prism-data-grid__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid var(--prism-data-grid-line);
}

.prism-data-grid__status {
  flex: 1;
  min-width: 0;
  font-size: 0.875em;
  opacity: 0.8;
}

.prism-data-grid__status--error {
  color: var(--prism-data-grid-error);
  opacity: 1;
}

.prism-data-grid__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-block: 7px;
}

/* The pager's chevrons point the way the pages go, which is leftwards right to left. */
.prism-data-grid__button--previous svg,
.prism-data-grid__pager:dir(rtl) > .prism-data-grid__button svg { scale: -1 1; }
.prism-data-grid__pager:dir(rtl) > .prism-data-grid__button--previous svg { scale: none; }

.prism-data-grid__pager {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875em;
}

.prism-data-grid__page {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

/* Wide enough for five digits. */
.prism-data-grid__page-field {
  --prism-textbox-width: 72px;
  --prism-textbox-height: 32px;
  --prism-textbox-padding: 10px;
  text-align: center;
}

/* A page is never cleared, only typed over: the pill has no clear button. */
.prism-data-grid__page-field > .prism-textbox__separator,
.prism-data-grid__page-field > .prism-textbox__clear { display: none; }

.prism-data-grid__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
`
