// The textarea is the textbox grown to several lines, and takes its look from
// textField.styles.ts: the pill is a .prism-textbox too, so its tint, its ring, the
// edge it fades into, its selection and every --prism-textbox-* token are the
// textbox's, and a theme that restyles one restyles both. Only what several lines
// and a resize change is here, so these rules are written to outweigh those.
//
// Its corners are -radius rather than a capsule's, which would run into the text
// on anything taller than a line. Its height is -height, by default auto, which
// leaves it to the field's `rows`; once resized it has one set inline, and the
// field stretches to it. The first line is centred in a textbox's height
// (--prism-textbox-height), as is the clear button, so they line up. The separator
// runs the whole height of the pill, less the margin a textbox's leaves at each
// end, and the text never runs under anything in the column beyond it.
//
// The column holds the scrollbar too, between the clear button and the handle.
// A field's own scrollbar can't be moved there or shortened, so it is hidden, and
// .prism-textarea__bar, a scroller of its own, stands in for it as a ScrollArea's
// does (src/components/scroll/area/scrollbars.ts). That takes no width from the
// text, so nothing re-wraps as the text starts to overflow. Where scrollbars
// overlay the content the pill gets data-native-scrollbars, which gives the field
// its own back. The bar is centred on the clear button's icon, whatever its
// thickness, as is the handle. .prism-textarea__rail is the room it has, running
// to within 4px of the icon and the grip, into the spare height of their buttons,
// and takes no pointer events of its own. With too little room for a bar to work it hides,
// and the text still scrolls by wheel, touch and keyboard: that limit is written
// in the query, as a query can't read a tuning property.
//
// The handle sits in the corner at the end of the bottom edge, on the logical
// side like the clear button, so in text that runs right to left it is at the
// bottom left and its cursor and grip are mirrored. -min-width, -min-height and
// a width of at most 100% hold the pill wherever a resize tries to take it, so
// the handle needs no limits of its own (useResizeHandle). The 100% is in the
// width as well as the max-width: a width in pixels alone widens a grid track
// sized to its content, over whatever lies beside it, and the max-width is then
// measured against the wider track. touch-action leaves a drag on it to the
// handle, rather than scrolling the page.
//
// The tuning properties are set on :where(:root) rather than on the textarea, so
// they can be overridden on the textarea itself or once on any ancestor.
export const textareaStyles = `
:where(:root) {
  --prism-textarea-width: 320px;
  --prism-textarea-height: auto;
  --prism-textarea-min-width: 160px;
  --prism-textarea-min-height: 72px;
  --prism-textarea-radius: 20px;
  --prism-textarea-line-height: 20px;
  --prism-textarea-resize-size: 24px;
}

.prism-textarea.prism-textbox {
  --_prism-textarea-column-centre: calc((var(--prism-textbox-clear-size) + 2px) / 2);
  align-items: flex-start;
  width: min(100%, var(--prism-textarea-width));
  height: var(--prism-textarea-height);
  min-width: var(--prism-textarea-min-width);
  min-height: var(--prism-textarea-min-height);
  max-width: 100%;
  border-radius: var(--prism-textarea-radius);
}

.prism-textarea .prism-textbox__input {
  align-self: stretch;
  height: auto;
  padding-block: calc((var(--prism-textbox-height) - var(--prism-textarea-line-height)) / 2);
  line-height: var(--prism-textarea-line-height);
  overflow: auto;
  resize: none;
}

.prism-textarea:not([data-native-scrollbars]) .prism-textbox__input { scrollbar-width: none; }

.prism-textarea:not([data-native-scrollbars]) .prism-textbox__input::-webkit-scrollbar { display: none; }

.prism-textarea .prism-textbox__separator {
  align-self: stretch;
  height: auto;
  margin-block: calc((var(--prism-textbox-height) - var(--prism-textbox-separator-height)) / 2);
}

.prism-textarea .prism-textbox__clear {
  height: var(--prism-textbox-height);
  border-end-end-radius: 0;
}

.prism-textarea__rail {
  position: absolute;
  inset-block: calc(var(--prism-textbox-height) / 2 + 10px) calc(var(--prism-textarea-resize-size) / 2 + 11px);
  inset-inline-end: 0;
  display: block;
  width: var(--prism-textbox-clear-size);
  container-type: size;
  pointer-events: none;
}

.prism-textarea__bar {
  position: absolute;
  inset-block: 0;
  inset-inline-end: var(--_prism-textarea-column-centre);
  display: block;
  overflow: hidden scroll;
  pointer-events: auto;
  translate: 50% 0;
}

.prism-textarea__bar:dir(rtl) { translate: -50% 0; }

.prism-textarea__extent {
  display: block;
  width: 1px;
}

@container (max-height: 31px) {
  .prism-textarea__bar { visibility: hidden !important; }
}

.prism-textarea .prism-textarea__resize {
  position: absolute;
  inset-block-end: 2px;
  inset-inline-end: calc(var(--_prism-textarea-column-centre) - var(--prism-textarea-resize-size) / 2);
  width: var(--prism-textarea-resize-size);
  height: var(--prism-textarea-resize-size);
  border-end-end-radius: calc(var(--prism-textarea-radius) - 2px);
  cursor: nwse-resize;
  touch-action: none;
}

.prism-textarea .prism-textarea__resize:dir(rtl) { cursor: nesw-resize; }

.prism-textarea__resize:dir(rtl) svg { scale: -1 1; }
`
