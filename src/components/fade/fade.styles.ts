// A Fade's content is in layers, and every layer sits in the one cell of a
// grid, so new content shows in the same place as the old and the box is as
// big as the biggest. A layer is a one-cell grid too, so its content fills it.
// The newest layer is on top.
//
// A layer fades by opacity, which the browser composites without repainting
// the content. A new layer (__layer--in) starts transparent, through
// @starting-style, and fades in. What happens to the one it replaces is the
// mode's (useLayers.ts):
//
// - layer: the old layer fades out (__layer--out) and goes, and the new one
//   comes in over it as it goes: it waits until --prism-fade-overlap before
//   the old has gone, so the two barely show at once, but the box never stands
//   empty between them, which reads as a blink. Both are quick: the old leaves
//   easing in, gathering pace as it goes (--prism-fade-out-*), so by the time
//   the new starts most of it has gone, and the new arrives easing out,
//   settling into place (--prism-fade-in-*).
// - background: the new layer fades in over the old, which stays as it is
//   under it (__layer--under) until covered, then goes, so the one shows
//   through the other without a gap. The fade is slower
//   (--prism-fade-background-duration) and always eases in and out, as
//   GlassBackdrop's crossfade of its image does, over the same duration.
//
// Every transition takes its timing from the state it heads to, as the press
// does, and a fade turned back part way reverses from wherever it got to.
//
// A layer on its way out or under takes no pointer events (it is inert too).
// No layer has a will-change: a will-change on opacity makes an element a
// backdrop root, which would cut any backdrop-filter inside it off from what is
// behind the layer all the time rather than only while it fades.
//
// The glass of cards in a layer fades with it (see src/components/backdrop).
//
// The tuning properties are set on :where(:root), so they can be overridden on
// the element or once on any ancestor.
export const fadeStyles = `
:where(:root) {
  --prism-fade-out-duration: 150ms;
  --prism-fade-out-easing: var(--prism-ease-in);
  --prism-fade-in-duration: 200ms;
  --prism-fade-in-easing: var(--prism-ease-out);
  --prism-fade-overlap: 60ms;
  --prism-fade-background-duration: 450ms;
}

.prism-fade,
.prism-fade__layer {
  display: grid;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
}

.prism-fade__layer {
  grid-area: 1 / 1;
  transition: opacity var(--prism-fade-in-duration) var(--prism-fade-in-easing);
}

.prism-fade--background > .prism-fade__layer {
  transition: opacity var(--prism-fade-background-duration) var(--prism-ease-in-out);
}

@starting-style {
  .prism-fade__layer--in { opacity: 0; }
}

.prism-fade:not(.prism-fade--background) > .prism-fade__layer--in {
  transition-delay: max(0s, var(--prism-fade-out-duration) - var(--prism-fade-overlap));
}

.prism-fade__layer--out {
  opacity: 0;
  transition-duration: var(--prism-fade-out-duration);
  transition-timing-function: var(--prism-fade-out-easing);
}

.prism-fade__layer--out,
.prism-fade__layer--under { pointer-events: none; }
`
