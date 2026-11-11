// Thin glass scrollbars for an element with the .prism-scrollbar class: no
// track and no arrows, just a slim translucent thumb over whatever is behind, a
// little stronger while the pointer is over the scroller.
//
// --prism-scrollbar-thumb and --prism-scrollbar-thumb-hover are set on
// :where(:root), as the card's tuning properties are, so they can be overridden
// on the scroller or once on any ancestor, and follow prefers-color-scheme.
//
// Chromium and WebKit are styled through ::-webkit-scrollbar, which draws a thumb
// inset from a transparent border so it floats clear of the edge, and no arrows.
// scrollbar-width and scrollbar-color are only for browsers without it (Firefox,
// whose scrollbars have no arrows): where both exist either of those turns the
// ::-webkit-scrollbar rules off, and nothing else takes the arrows away, so they
// must never reach Chromium. That goes for any rule on a scroller.
export const scrollbarStyles = `
:where(:root) {
  --prism-scrollbar-thumb: rgb(17 19 24 / 0.28);
  --prism-scrollbar-thumb-hover: rgb(17 19 24 / 0.45);
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-scrollbar-thumb: rgb(255 255 255 / 0.28);
    --prism-scrollbar-thumb-hover: rgb(255 255 255 / 0.45);
  }
}

.prism-scrollbar::-webkit-scrollbar {
  width: 10px;
  height: 10px;
  background: transparent;
}

.prism-scrollbar::-webkit-scrollbar-button { display: none; }

.prism-scrollbar::-webkit-scrollbar-track,
.prism-scrollbar::-webkit-scrollbar-corner {
  background: transparent;
}

.prism-scrollbar::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 10px;
  background: var(--prism-scrollbar-thumb) padding-box;
}

.prism-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: var(--prism-scrollbar-thumb-hover);
}

@supports not selector(::-webkit-scrollbar) {
  .prism-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--prism-scrollbar-thumb) transparent;
  }

  .prism-scrollbar:hover {
    scrollbar-color: var(--prism-scrollbar-thumb-hover) transparent;
  }
}
`
