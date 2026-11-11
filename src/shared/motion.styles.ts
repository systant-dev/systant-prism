// The motion tokens every component's timing is drawn from, so a press, a
// glide, a fade and a light all move on the same few curves. Each component
// renders this sheet with its own, so the tokens are there whichever is on the
// page.
//
// - ease-out: quick to start, settling into place. Things arriving.
// - ease-out-strong: the same, more so, with a longer tail. Things gliding.
// - ease-out-long: steeper still, most of the move early and the rest creeping
//   in. Things drifting home after the rest has settled.
// - ease-in: slow to start, gathering pace. Things leaving.
// - ease-in-out: gentle at both ends. Crossfades, and lights fading away.
//
// The lights that follow the pointer (the glare, the inner sheen and the edge
// light) fade in over --prism-light-fade-in and out over the longer
// --prism-light-fade-out, so every light on an element comes and goes together.
//
// They are set on :where(:root) so they can be overridden on any element or
// once on any ancestor, and :where() keeps them below any :root rule of the
// page's own.
export const motionStyles = `
:where(:root) {
  --prism-ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --prism-ease-out-strong: cubic-bezier(0.22, 1, 0.36, 1);
  --prism-ease-out-long: cubic-bezier(0.16, 1, 0.3, 1);
  --prism-ease-in: cubic-bezier(0.32, 0, 0.67, 0);
  --prism-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --prism-light-fade-in: 250ms;
  --prism-light-fade-out: 600ms;
}
`
