// The look a Textbox and a Textarea share, whose classes and tuning properties
// are named for the textbox: a text input in a pill, a plain ring round the
// input, a short vertical separator and a clear button at the end of the line.
//
// At rest it is flat. There is no glass, no shadow and no light, just a ring
// (-border) painted by ::before, the rim's width, round a plain tint (-bg at
// -opacity) that what is behind it shows through, unblurred. The tint is most of
// what the text sits on, so the text has a colour of its own (-fg) to match it
// rather than taking one from around it, as a card's would be picked for the
// card and not the tint.
//
// Focused, anywhere inside it, the ring gives way to the toggle's edge: the
// shared rim (src/effects/rim), lit softly from straight above whether or not
// the textbox lies on a card, over the shading of a groove inside its top edge
// (-focus-shadow), painted by ::after. The ring and those two crossfade by their
// opacity alone, so the flat edge seems to sink into the surface and nothing
// repaints. The rim's span comes after the shading, so the rim lies over it.
// ::after also carries a thin second coat of the tint, as thick as takes the two
// together to -focus-opacity, so the tint thickens as the edge fades in. The
// pill's own background never transitions: mid-way, browsers compute it as an
// oklab() that readableSelection's colours are judged without. They all fade in
// over -focus-duration and out over the longer -blur-duration, a little slower
// than the lights. A fade isn't movement, so they fade with
// prefers-reduced-motion too.
//
// The input has no outline of its own: the rim is what shows it has the focus,
// alongside the caret. :focus-visible matches a text input however it got the
// focus, so a ring there would show on every click as well. The clear button
// has a ring (-focus), since nothing else would show its focus.
//
// The input fills the pill up to the separator, so a press there lands in it,
// and takes the pill's height, so the pill's own padding is on the input and
// the clear button, not the pill: the clear button runs to the pill's far end.
// Its own width is 0, as an input's default would make a pill in a percentage
// width too wide for what it is in. Both lie on logical sides, so in text that
// runs right to left the clear button is on the left.
//
// The clear button is a bare icon (.prism-textbox__icon-button, which a textarea's
// handle is too), as dim as -clear-opacity, brightening on hover, and dimmer still
// with nothing to clear (-clear-disabled-opacity). It takes no pointer events then,
// so a press on it lands on the pill.
//
// Inside a GlassBackdrop its text and selection are the page's, the same on every
// field (useGlassText and useGlassSelection, src/components/backdrop), and so is
// the tint. Selected text is shown on a shade of the image's dominant colour, so
// the highlight belongs to what is behind it. Elsewhere the selection is a shade
// of -selection, as near as will do (readableSelection, src/contrast), with
// -selection-fg on it. The field is translucent, so whether a highlight shows at
// all depends on what is behind it. They are set inline as --_prism-textbox-fg,
// --_prism-textbox-selection-bg and -fg, which the styles prefer.
//
// Disabled, the whole thing fades: with no glass there is nothing for that to
// tear.
//
// A pill can have one more bare icon after the clear button, .prism-textbox__end-button
// (a Combobox's chevron, a Calendar's icon), which takes the pill's far end from it,
// so the clear button gives up its rounded corners. Each is its icon and its padding,
// 24px wide, the least a pointer target may be (WCAG 2.5.8) with no space round it.
// The padding is mostly on the sides facing away, so the icons keep close: the
// facing sides are 7px between them, which shows as 10px, as the icons stop short
// of their boxes.
//
// The tuning properties are set on :where(:root) rather than on the textbox, so
// they can be overridden on the textbox itself or once on any ancestor.
export const textFieldStyles = `
:where(:root) {
  --prism-textbox-width: 240px;
  --prism-textbox-height: 40px;
  --prism-textbox-padding: 16px;
  --prism-textbox-bg: #f3f4f6;
  --prism-textbox-opacity: 0.6;
  --prism-textbox-focus-opacity: 0.65;
  --prism-textbox-fg: #111318;
  --prism-textbox-border: rgb(17 19 24 / 0.25);
  --prism-textbox-placeholder-opacity: 0.6;
  --prism-textbox-selection: #6d7cff;
  --prism-textbox-selection-fg: #111318;
  --prism-textbox-focus-shadow: inset 0 1px 3px rgb(17 19 24 / 0.22);
  --prism-textbox-focus-duration: 350ms;
  --prism-textbox-blur-duration: 800ms;
  --prism-textbox-separator: rgb(17 19 24 / 0.2);
  --prism-textbox-separator-height: 16px;
  --prism-textbox-clear-size: 34px;
  --prism-textbox-clear-opacity: 0.65;
  --prism-textbox-clear-disabled-opacity: 0.3;
  --prism-textbox-focus: #6d7cff;
  --prism-textbox-disabled-opacity: 0.45;
}

.prism-textbox {
  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  width: var(--prism-textbox-width);
  height: var(--prism-textbox-height);
  border-radius: 9999px;
  background-color: color-mix(in srgb, var(--prism-textbox-bg) calc(var(--prism-textbox-opacity) * 100%), transparent);
  color: var(--_prism-textbox-fg, var(--prism-textbox-fg));
  isolation: isolate;
}

.prism-textbox::before,
.prism-textbox::after {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0;
  box-sizing: border-box;
  border-radius: inherit;
  pointer-events: none;
  transition: opacity var(--prism-textbox-blur-duration) var(--prism-ease-out);
}

.prism-textbox::before { border: var(--prism-button-rim-width) solid var(--prism-textbox-border); }

.prism-textbox::after {
  background-color: color-mix(
    in srgb,
    var(--prism-textbox-bg)
      calc((var(--prism-textbox-focus-opacity) - var(--prism-textbox-opacity)) / (1 - var(--prism-textbox-opacity)) * 100%),
    transparent
  );
  box-shadow: var(--prism-textbox-focus-shadow);
  opacity: 0;
}

.prism-textbox > .prism-rim {
  opacity: 0;
  transition: opacity var(--prism-textbox-blur-duration) var(--prism-ease-out);
}

.prism-textbox:focus-within::before { opacity: 0; }

.prism-textbox:focus-within::after,
.prism-textbox:focus-within > .prism-rim { opacity: 1; }

.prism-textbox:focus-within::before,
.prism-textbox:focus-within::after,
.prism-textbox:focus-within > .prism-rim {
  transition-duration: var(--prism-textbox-focus-duration);
}

.prism-textbox__input {
  flex: 1;
  box-sizing: border-box;
  width: 0;
  height: 100%;
  margin: 0;
  padding-block: 0;
  padding-inline: var(--prism-textbox-padding) 8px;
  border: 0;
  outline: 0;
  border-radius: 0;
  border-start-start-radius: inherit;
  border-end-start-radius: inherit;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  -webkit-tap-highlight-color: transparent;
}

.prism-textbox__input::placeholder {
  color: inherit;
  opacity: var(--prism-textbox-placeholder-opacity);
}

.prism-textbox__input::selection {
  background-color: var(--_prism-textbox-selection-bg, var(--prism-textbox-selection));
  color: var(--_prism-textbox-selection-fg, var(--prism-textbox-selection-fg));
}

/* The clear button stands in for the browser's own on type="search". */
.prism-textbox__input::-webkit-search-cancel-button { appearance: none; }

.prism-textbox__separator {
  flex: none;
  width: var(--prism-button-rim-width);
  height: var(--prism-textbox-separator-height);
  background: var(--prism-textbox-separator);
}

.prism-textbox__icon-button {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  opacity: var(--prism-textbox-clear-opacity);
  -webkit-tap-highlight-color: transparent;
  transition: opacity 200ms var(--prism-ease-out);
}

.prism-textbox__icon-button:disabled {
  cursor: default;
  opacity: var(--prism-textbox-clear-disabled-opacity);
  pointer-events: none;
}

@media (hover: hover) {
  .prism-textbox__icon-button:hover:not(:disabled) { opacity: 1; }
}

.prism-textbox__icon-button:focus-visible {
  opacity: 1;
  outline: 2px solid var(--prism-textbox-focus);
  outline-offset: -2px;
}

.prism-textbox__clear {
  flex: none;
  width: var(--prism-textbox-clear-size);
  height: 100%;
  padding-inline-end: 2px;
  border-start-end-radius: inherit;
  border-end-end-radius: inherit;
}

.prism-textbox__clear:has(~ .prism-textbox__end-button) {
  width: auto;
  padding-inline: 9px 3px;
  border-radius: 0;
}

.prism-textbox__end-button {
  flex: none;
  height: 100%;
  padding-inline: 4px 8px;
  border-start-end-radius: inherit;
  border-end-end-radius: inherit;
}

.prism-textbox--disabled { opacity: var(--prism-textbox-disabled-opacity); }

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-textbox-bg: #24272e;
    --prism-textbox-fg: #eceef2;
    --prism-textbox-border: rgb(255 255 255 / 0.25);
    --prism-textbox-selection: #9aa5ff;
    --prism-textbox-focus-shadow: inset 0 1px 3px rgb(0 0 0 / 0.45);
    --prism-textbox-separator: rgb(255 255 255 / 0.2);
    --prism-textbox-focus: #9aa5ff;
  }
}
`
