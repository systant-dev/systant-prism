// A menu is a Popup (../popup/Popup.styles.ts) holding a list of rows in a
// ScrollArea no taller than -max-height or the window. This is only what those two
// don't bring.
//
// The list is a grid of four columns: a row's icon, its label, its shortcut and the
// tick of a checkbox or radio that is on. A submenu's chevron spans the last two, so
// it ends its row whichever of them the menu uses. The rows and groups are the
// list's subgrids, so those columns line up all the way down, and one that no row
// uses takes no room. A label too long for -max-width ends in an ellipsis.
//
// The tick is a Combobox's: the same size and gap at the end of the row, so on the
// left in text running right to left. A checkbox or radio keeps its column while
// off, so ticking one moves nothing.
//
// A slider's row has its value where a shortcut would be, and the slider on a line
// of its own under them, across all four columns. The slider is a range input with
// its native look taken away: a track of the text colour, a tint of it at
// -slider-track-opacity (-slider-track-height high), filled up to a round thumb
// (-slider-thumb-size) of the text colour itself, which holds on any image, as the
// lit row's tint does. The fill stops at the middle of the thumb, which only
// travels the track's width less its own. Forced colors, which remove all of that,
// get the native slider back.
//
// The lit row is the one with the focus, lit by a tint of the text colour itself
// (-active-opacity), which holds on any image a GlassBackdrop shows, as a Combobox's
// active entry does. A row whose submenu is open stays lit, as the focus moves into
// the submenu. The tint is all that shows the focus, so forced colours, which
// remove it, get an outline. A dangerous row mixes -danger with the text colour, so
// it stays readable on glass of any shade. A slider's row lights up as its slider
// takes the focus.
//
// A submenu is a popup as well, and so fades in and out as any does, sliding out of
// the row that opened it. It slides further, -submenu-slide, as it has only a row to
// come out of: to the right from a little to its left, as it goes back there to
// fade out, and the other way when it opens on the row's left. With
// prefers-reduced-motion it only fades, as a popup does.
//
// The tuning properties are set on :where(:root), so they can be overridden on any
// ancestor.
export const menuStyles = `
:where(:root) {
  --prism-menu-min-width: 180px;
  --prism-menu-max-width: 340px;
  --prism-menu-max-height: 420px;
  --prism-menu-row-height: 34px;
  --prism-menu-row-radius: 10px;
  --prism-menu-active-opacity: 0.12;
  --prism-menu-disabled-opacity: 0.45;
  --prism-menu-muted-opacity: 0.65;
  --prism-menu-line-opacity: 0.15;
  --prism-menu-danger: #e5484d;
  --prism-menu-submenu-slide: 8px;
  --prism-menu-slider-thumb-size: 14px;
  --prism-menu-slider-track-height: 4px;
  --prism-menu-slider-track-opacity: 0.25;
}

.prism-menu {
  min-width: var(--prism-menu-min-width);
  max-width: min(var(--prism-menu-max-width), calc(100vw - 16px));
}

.prism-menu--submenu { --prism-popup-slide: var(--prism-menu-submenu-slide); }

.prism-menu__scroll {
  max-height: min(var(--prism-menu-max-height), calc(100dvh - 16px));
  border-radius: inherit;
}

.prism-menu__list {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  padding: 4px;
  outline: none;
}

.prism-menu__item,
.prism-menu__group {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
}

.prism-menu__item {
  align-items: center;
  box-sizing: border-box;
  min-height: var(--prism-menu-row-height);
  padding: 6px 12px;
  border-radius: var(--prism-menu-row-radius);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  outline: none;
  /* Stops a keyed move leaving a row under the list's fading edge */
  scroll-margin-block: 24px;
  -webkit-tap-highlight-color: transparent;
}

.prism-menu__item:focus,
.prism-menu__item:has(> .prism-menu__slider:focus),
.prism-menu__item[aria-expanded='true'],
.prism-menu__item:not([aria-disabled='true'], :has(> :disabled)):active {
  background: color-mix(in srgb, currentColor calc(var(--prism-menu-active-opacity) * 100%), transparent);
}

.prism-menu__item[aria-disabled='true'],
.prism-menu__item:has(> :disabled) {
  cursor: default;
  opacity: var(--prism-menu-disabled-opacity);
}

.prism-menu__item--danger { color: color-mix(in srgb, var(--prism-menu-danger) 75%, currentColor); }

.prism-menu__lead {
  grid-column: 1;
  display: grid;
  place-items: center;
  min-width: 16px;
  margin-inline-end: 8px;
}

.prism-menu__label {
  grid-column: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prism-menu__shortcut,
.prism-menu__value,
.prism-menu__chevron {
  grid-column: 3;
  justify-self: end;
  margin-inline-start: 24px;
  opacity: var(--prism-menu-muted-opacity);
}

.prism-menu__shortcut {
  font-size: 0.85em;
  white-space: nowrap;
}

.prism-menu__value {
  grid-column: 3 / -1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.prism-menu__item--slider {
  row-gap: 4px;
  cursor: default;
}

.prism-menu__slider {
  --_prism-menu-slider-fill: calc(
    var(--prism-menu-slider-thumb-size) / 2 + var(--_prism-menu-slider-at) * (100% - var(--prism-menu-slider-thumb-size))
  );
  --_prism-menu-slider-way: to right;
  grid-column: 1 / -1;
  box-sizing: border-box;
  width: 100%;
  height: var(--prism-menu-slider-thumb-size);
  margin: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  outline: none;
  appearance: none;
}

.prism-menu__slider:dir(rtl) { --_prism-menu-slider-way: to left; }

.prism-menu__slider:disabled { cursor: default; }

.prism-menu__slider::-webkit-slider-runnable-track {
  height: var(--prism-menu-slider-track-height);
  border-radius: 9999px;
  background: linear-gradient(
    var(--_prism-menu-slider-way),
    currentColor var(--_prism-menu-slider-fill),
    color-mix(in srgb, currentColor calc(var(--prism-menu-slider-track-opacity) * 100%), transparent) 0
  );
}

.prism-menu__slider::-moz-range-track {
  height: var(--prism-menu-slider-track-height);
  border-radius: 9999px;
  background: linear-gradient(
    var(--_prism-menu-slider-way),
    currentColor var(--_prism-menu-slider-fill),
    color-mix(in srgb, currentColor calc(var(--prism-menu-slider-track-opacity) * 100%), transparent) 0
  );
}

.prism-menu__slider::-webkit-slider-thumb {
  box-sizing: border-box;
  width: var(--prism-menu-slider-thumb-size);
  height: var(--prism-menu-slider-thumb-size);
  margin-block-start: calc((var(--prism-menu-slider-track-height) - var(--prism-menu-slider-thumb-size)) / 2);
  border: 0;
  border-radius: 50%;
  background: currentColor;
  appearance: none;
}

.prism-menu__slider::-moz-range-thumb {
  box-sizing: border-box;
  width: var(--prism-menu-slider-thumb-size);
  height: var(--prism-menu-slider-thumb-size);
  border: 0;
  border-radius: 50%;
  background: currentColor;
}

.prism-menu__chevron {
  grid-column: 3 / -1;
  display: grid;
  /* Its ink ends where a tick's does */
  margin-inline-end: -2px;
}

.prism-menu__tick {
  grid-column: 4;
  display: grid;
  min-width: 14px;
  margin-inline-start: 8px;
}

.prism-menu__chevron:dir(rtl) { scale: -1 1; }

.prism-menu__heading {
  grid-column: 1 / -1;
  padding: 8px 12px 4px;
  font-size: 0.8em;
  opacity: var(--prism-menu-muted-opacity);
  user-select: none;
}

.prism-menu__line {
  grid-column: 1 / -1;
  height: 1px;
  margin: 4px 8px;
  background: color-mix(in srgb, currentColor calc(var(--prism-menu-line-opacity) * 100%), transparent);
}

@media (forced-colors: active) {
  .prism-menu__item:focus,
  .prism-menu__item:has(> .prism-menu__slider:focus),
  .prism-menu__item[aria-expanded='true'] {
    outline: 2px solid Highlight;
    outline-offset: -2px;
  }

  .prism-menu__slider { appearance: auto; }
}
`
