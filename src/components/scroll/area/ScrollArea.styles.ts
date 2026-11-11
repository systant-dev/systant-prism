// A scroll area: .prism-scroll-area is the box laid out in the page, and its
// one grid cell holds .prism-scroll-area__viewport, which fills it and scrolls.
// minmax(0, 1fr) lets the viewport shrink below its content, so a fixed, flexed
// or max- height on the area makes it scroll, while an area left to size itself
// grows with its content; min-width and min-height 0 let it shrink as a flex
// or grid item.
//
// The viewport fades its content out where it is cut off
// (../fade/scrollFade.styles.ts), and no more than that: nothing is blurred
// there too, as over glass a blur reads as a shadow.
//
// The viewport hides its own scrollbars; .prism-scroll-area__bar draws each
// instead, along the inline-end side or the bottom and laid over the content,
// inset from both ends by --prism-scroll-area-bar-inset (the card radius) so its
// ends clear a card's rounded corners. The area is their containing block;
// position: relative is applied through :where() so any position the area
// already sets wins. A bar is as thick
// as its scrollbar, and its .prism-scroll-area__extent is sized by
// scrollbars.ts. Where scrollbars overlay the content instead, the bars are
// hidden and the area gets data-native-scrollbars, which gives the viewport
// its own back.
//
// The fade's mask hides the viewport's own focus outline
// (../fade/scrollFade.styles.ts), so while the viewport has keyboard focus the
// area draws it instead, in --prism-scroll-area-focus, set on :where(:root)
// like the button's.
export const scrollAreaStyles = `
:where(:root) {
  --prism-scroll-area-focus: #6d7cff;
}

@media (prefers-color-scheme: dark) {
  :where(:root) { --prism-scroll-area-focus: #9aa5ff; }
}

.prism-scroll-area:has(> .prism-scroll-fade:focus-visible) {
  outline: 2px solid var(--prism-scroll-area-focus);
  outline-offset: 2px;
}

.prism-scroll-area {
  display: grid;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
}

:where(.prism-scroll-area) {
  position: relative;
}

.prism-scroll-area--y > .prism-scroll-area__viewport {
  overflow: hidden auto;
}

.prism-scroll-area--x > .prism-scroll-area__viewport {
  overflow: auto hidden;
}

.prism-scroll-area--both > .prism-scroll-area__viewport {
  overflow: auto;
}

.prism-scroll-area:not([data-native-scrollbars]) > .prism-scroll-area__viewport {
  scrollbar-width: none;
}

.prism-scroll-area:not([data-native-scrollbars]) > .prism-scroll-area__viewport::-webkit-scrollbar {
  display: none;
}

.prism-scroll-area__bar {
  --inset: var(--prism-scroll-area-bar-inset, var(--prism-card-radius, 16px));
  position: absolute;
}

.prism-scroll-area__bar--y {
  inset-block: var(--inset);
  inset-inline-end: 0;
  overflow: hidden scroll;
}

.prism-scroll-area__bar--x {
  inset-inline: var(--inset);
  bottom: 0;
  overflow: scroll hidden;
}

.prism-scroll-area__bar--y > .prism-scroll-area__extent { width: 1px; }
.prism-scroll-area__bar--x > .prism-scroll-area__extent { height: 1px; }

.prism-scroll-area:hover > .prism-scroll-area__bar::-webkit-scrollbar-thumb {
  background-color: var(--prism-scrollbar-thumb-hover);
}

@supports not selector(::-webkit-scrollbar) {
  .prism-scroll-area:hover > .prism-scroll-area__bar {
    scrollbar-color: var(--prism-scrollbar-thumb-hover) transparent;
  }
}
`
