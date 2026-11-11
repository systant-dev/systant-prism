// The overlay is a modal <dialog>, so the browser shows it in the top layer, and
// it covers the whole viewport with a Progress ring in the middle.
//
// The dialog itself is the dim: a light, dark coat (--prism-progress-dim) over the
// page, with no blur, as a blur the size of the viewport would have to be redrawn
// for every frame of the spin. It is dark whether the page's glass is dark or
// light, as that is what dimming is.
//
// The ring's glass is a canvas of its own (usePopupGlass), .prism-progress__glass,
// as what lies under the dialog can't show through it bent. It is under the
// ring's tint and shows only the GlassBackdrop's image, so to agree with the page
// around it, it has the dim laid over it as well. The canvas is opaque and square,
// so it is masked to the hoop, its two edges softened as a Progress's lens is.
//
// It fades in when opened and out when closed, quickly: a wait shouldn't be drawn out
// by the thing that says it is one. The dim and the ring each have a fade of their
// own, as opacity on the dialog would take both at the ring's pace, and a whole page
// changing that fast reads as a jump. So the dim is the dialog's background colour,
// fading in and out over --prism-progress-dim-duration, and the ring fades on its own
// opacity. The ring's inner fades are turned off, so nothing lags behind that
// (--prism-progress-appear, which sets the bend's fade too). Opening starts both from
// nothing through @starting-style; closing keeps the dialog displayed and in the top
// layer (display and overlay, allow-discrete) until both have faded, as a popup does,
// with presses going through it to the page that is by then back in reach.
//
// Only those change as it closes: what else lies on [open] goes the moment it closes,
// with the fade still to run. So the ring's centring is on the dialog itself, for
// display to find it there all the way out, where a closing ring would otherwise drop
// to the top left corner and fade there.
//
// The tuning properties are set on :where(:root), so they can be overridden on
// the overlay itself or once on any ancestor.
const thickness = 'var(--prism-progress-thickness)'
const soft = 'var(--prism-progress-edge-soft)'

export const progressOverlayStyles = `
:where(:root) {
  --prism-progress-dim: rgb(0 0 0 / 0.25);
  --prism-progress-dim-duration: 250ms;
  --prism-progress-dim-easing: var(--prism-ease-in-out);
  --prism-progress-overlay-in-duration: 150ms;
  --prism-progress-overlay-in-easing: var(--prism-ease-out);
  --prism-progress-overlay-out-duration: 120ms;
  --prism-progress-overlay-out-easing: var(--prism-ease-in);
}

:where(.prism-progress-overlay) {
  --prism-progress-appear: 0s;
}

.prism-progress-overlay {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  overflow: hidden;
  background: transparent;
  pointer-events: none;
  transition-property: background-color, display, overlay;
  transition-behavior: allow-discrete;
  transition-duration:
    var(--prism-progress-dim-duration),
    max(var(--prism-progress-dim-duration), var(--prism-progress-overlay-out-duration)),
    max(var(--prism-progress-dim-duration), var(--prism-progress-overlay-out-duration));
  transition-timing-function: var(--prism-progress-dim-easing);
}

.prism-progress-overlay::backdrop { background: none; }

.prism-progress-overlay[open] {
  display: flex;
  background: var(--prism-progress-dim);
  pointer-events: auto;
}

.prism-progress-overlay > .prism-progress {
  opacity: 0;
  transition: opacity var(--prism-progress-overlay-out-duration) var(--prism-progress-overlay-out-easing);
}

.prism-progress-overlay[open] > .prism-progress {
  opacity: 1;
  transition-duration: var(--prism-progress-overlay-in-duration);
  transition-timing-function: var(--prism-progress-overlay-in-easing);
}

@starting-style {
  .prism-progress-overlay[open] { background-color: transparent; }
  .prism-progress-overlay[open] > .prism-progress { opacity: 0; }
}

.prism-progress__glass {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 50%;
  pointer-events: none;
  mask-image: radial-gradient(
    closest-side,
    transparent calc(100% - ${thickness} - ${soft} / 2),
    #000 calc(100% - ${thickness} + ${soft} / 2) calc(100% - ${soft}),
    transparent
  );
}

.prism-progress__glass > canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.prism-progress__glass::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--prism-progress-dim);
}
`
