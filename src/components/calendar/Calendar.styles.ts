// A Calendar is a textbox's pill (../textField/textField.styles.ts) with an icon at
// its far end, over a Popup (../popup/Popup.styles.ts) holding a month. This is
// only what those two don't bring.
//
// A month is seven columns of -day-size by six rows, however many weeks it has, so
// the panel keeps one size as the months go by. -day-gap lies between the days, taken
// from their cells, so a tint under the pointer never touches the edge of the picked
// day beside it. The days that make up its rows from the months either side are
// dimmed (-outside-opacity), and can be picked.
//
// Nothing here has a colour of its own: a tint or a line of the text colour holds
// on any image a GlassBackdrop shows, where the popup's text may be light or dark
// whatever the theme. So, as on a Combobox, a day under the pointer takes such a
// tint (-active-opacity), as does everything else here that can be pressed, all of
// them fading in over -hover-in-duration and out over the longer -hover-out-duration.
// A fade isn't movement, so they fade with prefers-reduced-motion too. Today, which
// nobody chose, takes only a dot, and days that can't be picked fade
// (-disabled-opacity).
//
// The picked day has the edge of a button, from the button's own tokens: the shared
// rim (src/effects/rim), which CalendarMonth.tsx renders in that day alone, soft
// here as on anything on a popup, with the crescents of light inside it, the glow and
// the sheen. Calendar.tsx renders the button's stylesheet for them, so a theme that
// restyles buttons restyles it. Under them is a thicker tint (-selected-opacity), so
// it shows on a popup whose text is dark, where a light rim would not. It takes no
// tint from the pointer, which would only thin it.
//
// A range is two picked days with a band behind the days between them, in cells of
// their own rather than on the days, so it runs on across the gaps. It is a tint of
// -range-opacity, on a ::before as a table's cells can't take corners, starting
// half way through the first day and stopping half way through the last, rounded
// where a week ends it. A touch mustn't scroll what it is dragging across.
//
// The heading of a month is a button, and looks it only under the pointer: a tint,
// with a chevron that turns over while the year is open. It hugs its text, centred
// between the arrows and all on one line. Its tint is a ::before behind it, reaching
// -heading-padding past the text, less on the chevron's side by the 3.5px its drawing
// stops short of its box, so it looks even on both. It takes no room, as padding
// would, and the longest titles (Spanish's, at 144px) would wrap for want of it: what
// doesn't fit between the arrows runs behind the empty edges of their buttons.
//
// The year is another Popup, the same width as the month, its twelve months sharing
// the look of the days, with the month being shown taking the picked day's edge, and
// this month the dot. A row of months is -month-height tall, and -month-gap-x and -y
// lie between them, taken from their cells, so a tint under the pointer never touches
// the edge of the month beside it and the year keeps its size. It lines up with the
// heading (CalendarMonth.tsx), then moves by margins, since a popup's left and top are
// its own and its translate is its slide: -year-offset-y down, and -year-inset along,
// out past the month's name. Its left is set whichever way the text runs, so that
// margin is a physical one, turned round right to left.
//
// Under the days, the button for today wears a tint at rest, as it would otherwise
// be a loose word, and a thicker one under the pointer.
//
// The focus shows on the keyboard only, as a press in the panel doesn't take it.
//
// The arrows mirror in text that runs right to left, as do the grids, by their
// columns, on their own.
//
// The tuning properties are set on :where(:root), so they can be overridden on
// any ancestor.
export const calendarStyles = `
:where(:root) {
  --prism-calendar-day-size: 36px;
  --prism-calendar-day-gap: 4px;
  --prism-calendar-day-radius: 10px;
  --prism-calendar-month-height: 44px;
  --prism-calendar-month-gap-x: 8px;
  --prism-calendar-month-gap-y: 4px;
  --prism-calendar-year-offset-y: 4px;
  --prism-calendar-year-inset: 4px;
  --prism-calendar-heading-padding: 14px;
  --prism-calendar-today-height: 32px;
  --prism-calendar-active-opacity: 0.12;
  --prism-calendar-hover-in-duration: 80ms;
  --prism-calendar-hover-out-duration: 200ms;
  --prism-calendar-selected-opacity: 0.24;
  --prism-calendar-range-opacity: 0.12;
  --prism-calendar-range-width: 320px;
  --prism-calendar-weekday-opacity: 0.7;
  --prism-calendar-outside-opacity: 0.6;
  --prism-calendar-disabled-opacity: 0.3;
}

/* Two days take twice the room of one, and anything longer than the field still ends tidily. */
.prism-calendar--range { --prism-textbox-width: var(--prism-calendar-range-width); }

.prism-calendar .prism-textbox__input { text-overflow: ellipsis; }

.prism-calendar__header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.prism-calendar__title {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-weight: 600;
}

.prism-calendar__heading {
  position: relative;
  flex: none;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
  height: var(--prism-calendar-day-size);
  margin-block: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  user-select: none;
  isolation: isolate;
  -webkit-tap-highlight-color: transparent;
}

.prism-calendar__heading::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset-block: 0;
  inset-inline: calc(-1 * var(--prism-calendar-heading-padding)) calc(3.5px - var(--prism-calendar-heading-padding));
  border-radius: var(--prism-calendar-day-radius);
}

.prism-calendar__heading > .prism-calendar__title {
  flex: none;
  white-space: nowrap;
}

.prism-calendar__heading > svg { flex: none; }

.prism-calendar__heading--open > svg { rotate: 180deg; }

@media (prefers-reduced-motion: no-preference) {
  .prism-calendar__heading > svg { transition: rotate 200ms var(--prism-ease-out); }
}

.prism-calendar__nav,
.prism-calendar__day,
.prism-calendar__month {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: var(--prism-calendar-day-size);
  height: var(--prism-calendar-day-size);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--prism-calendar-day-radius);
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.prism-calendar__nav { flex: none; }

.prism-calendar__nav:dir(rtl) > svg { scale: -1 1; }

.prism-calendar__nav[aria-disabled='true'] {
  cursor: default;
  opacity: var(--prism-calendar-disabled-opacity);
}

.prism-popup.prism-calendar__year {
  margin-block-start: var(--prism-calendar-year-offset-y);
  margin-left: calc(-1 * var(--prism-calendar-year-inset));
}

.prism-popup.prism-calendar__year:dir(rtl) { margin-left: var(--prism-calendar-year-inset); }

/* Far enough down to clear the year view, so the button stays reachable from it. */
.prism-calendar__footer {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.prism-calendar__today {
  box-sizing: border-box;
  height: var(--prism-calendar-today-height);
  margin: 0;
  padding: 0 14px;
  border: 0;
  border-radius: var(--prism-calendar-day-radius);
  background: color-mix(in srgb, currentColor calc(var(--prism-calendar-active-opacity) * 100%), transparent);
  color: inherit;
  font: inherit;
  font-size: 0.9em;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.prism-calendar__today[aria-disabled='true'] {
  cursor: default;
  opacity: var(--prism-calendar-disabled-opacity);
}

.prism-calendar__heading:focus-visible { outline: 0; }

.prism-calendar__nav:focus-visible,
.prism-calendar__today:focus-visible,
.prism-calendar__heading:focus-visible::before,
.prism-calendar__day:focus-visible,
.prism-calendar__month:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}

.prism-calendar__grid {
  border-collapse: collapse;
  table-layout: fixed;
  width: calc(7 * var(--prism-calendar-day-size));
  font-variant-numeric: tabular-nums;
}

.prism-calendar__grid--range { touch-action: none; }

.prism-calendar__cell--band { position: relative; }

.prism-calendar__cell--band::before {
  content: '';
  position: absolute;
  inset-block: calc(var(--prism-calendar-day-gap) / 2);
  inset-inline: 0;
  background: color-mix(in srgb, currentColor calc(var(--prism-calendar-range-opacity) * 100%), transparent);
}

.prism-calendar__cell--band-start::before { inset-inline-start: 50%; }

.prism-calendar__cell--band-end::before { inset-inline-end: 50%; }

.prism-calendar__cell--band:first-child::before {
  border-start-start-radius: var(--prism-calendar-day-radius);
  border-end-start-radius: var(--prism-calendar-day-radius);
}

.prism-calendar__cell--band:last-child::before {
  border-start-end-radius: var(--prism-calendar-day-radius);
  border-end-end-radius: var(--prism-calendar-day-radius);
}

.prism-calendar__grid th {
  width: var(--prism-calendar-day-size);
  padding: 0 0 4px;
  overflow: hidden;
  font-size: 0.8em;
  font-weight: 500;
  opacity: var(--prism-calendar-weekday-opacity);
}

.prism-calendar__grid td { padding: calc(var(--prism-calendar-day-gap) / 2); }

.prism-calendar__year td {
  padding: calc(var(--prism-calendar-month-gap-y) / 2) calc(var(--prism-calendar-month-gap-x) / 2);
}

.prism-calendar__heading::before,
.prism-calendar__nav,
.prism-calendar__day,
.prism-calendar__month,
.prism-calendar__today {
  transition: background-color var(--prism-calendar-hover-out-duration) var(--prism-ease-out);
}

.prism-calendar__day,
.prism-calendar__month { position: relative; }

.prism-calendar__day {
  width: 100%;
  height: calc(var(--prism-calendar-day-size) - var(--prism-calendar-day-gap));
}

.prism-calendar__month {
  width: 100%;
  height: calc(var(--prism-calendar-month-height) - var(--prism-calendar-month-gap-y));
}

.prism-calendar__day--outside { opacity: var(--prism-calendar-outside-opacity); }

.prism-calendar__day:disabled,
.prism-calendar__month:disabled {
  cursor: default;
  opacity: var(--prism-calendar-disabled-opacity);
}

@media (hover: hover) {
  .prism-calendar__nav:hover:not([aria-disabled='true']),
  .prism-calendar__heading:hover::before,
  .prism-calendar__day:not(.prism-calendar__day--edge):hover:not(:disabled),
  [aria-selected='false'] > .prism-calendar__month:hover:not(:disabled) {
    background-color: color-mix(in srgb, currentColor calc(var(--prism-calendar-active-opacity) * 100%), transparent);
  }

  .prism-calendar__heading:hover::before,
  .prism-calendar__nav:hover,
  .prism-calendar__day:hover,
  .prism-calendar__month:hover,
  .prism-calendar__today:hover { transition-duration: var(--prism-calendar-hover-in-duration); }

  .prism-calendar__today:hover:not([aria-disabled='true']) {
    background: color-mix(in srgb, currentColor calc(var(--prism-calendar-selected-opacity) * 100%), transparent);
  }
}

.prism-calendar__day[aria-current='date']::after,
.prism-calendar__month[aria-current='date']::after {
  content: '';
  position: absolute;
  inset-block-end: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.prism-calendar__day--edge,
[aria-selected='true'] > .prism-calendar__month {
  background: var(--prism-button-sheen)
    color-mix(in srgb, currentColor calc(var(--prism-calendar-selected-opacity) * 100%), transparent);
  box-shadow:
    inset 1px 1.5px 1px -0.5px var(--prism-button-highlight),
    inset -1px -1px 1px -0.5px var(--prism-button-bounce),
    var(--prism-button-glow);
  font-weight: 600;
}
`
