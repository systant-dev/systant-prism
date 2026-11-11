// The backdrop's image covers the viewport and stays put as the page scrolls,
// like `background: url() center / cover fixed`. It is drawn into a fixed canvas
// behind the backdrop's children: z-index -1 within the backdrop's own stacking
// context (isolation), so above the backdrop's background and below everything
// in it. The canvas stays hidden until it has drawn an image; until then, and
// wherever it can't draw, the image is the backdrop's CSS background instead.
//
// A new image crossfades in over a Fade's background duration,
// --prism-fade-background-duration (src/components/fade); a duration of 0s
// swaps straight away. They are read from the canvas, so they can be set on the
// backdrop or any ancestor.
//
// -fg and -bg are the theme's text and glass tint, kept wherever the text reads
// over the image, and -alt-fg and -alt-bg the opposite pair the page turns to
// where it doesn't. -accent is what the selection is kept near where the image
// has no dominant colour (see pagePalette.ts).
//
// --_prism-page-glass and --_prism-page-dimmest go with the colours: how thick the
// glass straight on the image must be for the text to read, and how far text may
// be dimmed on it. Outside a backdrop both are 0, which asks nothing of a control.
//
// The page's colours and those two numbers are held in --_prism-page-*, which are
// registered so they can transition: from one set to the next they fade over the
// same duration and easing as a new image. A transition is taken from the style being changed to, so
// --colours-fade only has to arrive along with the second set; the first goes
// straight on, there being nothing to fade from. Everything takes the colours by
// inheritance, so these are the only transitions, and a colour set on a control
// itself stays out of them.
//
// While the page waits for its first scene (useSceneArrival.ts), --waiting hides
// everything in the backdrop but its canvas and the ring. --sealed adds visibility,
// which takes it out of reach of the keyboard, and reaches what lies in the top layer,
// but only once it has all mounted, as a child's autoFocus can't take in what visibility
// has hidden, and a ring opening has to find that focus to give it back. Each child
// fades in for itself, as a wrapper round them would come between a flex or grid
// backdrop and its items. It is an opacity transition rather than an animation as
// glass follows those frame by frame (backdrop.ts). --arriving is what brings it, and
// only for as long as it takes, so that it doesn't stand in for a child's own the rest
// of the time.
//
// The ring goes last, with its own quick fade out, once all else has finished. Its dim
// doesn't stay that long, or the finished page would brighten at the very end: it lifts
// as the scene fades in, by the same duration (--clear), leaving only the ring. Waiting
// for the first scene there is no dim at all, as dimming the page's own background
// would only make it a colour it isn't. Its glass has that dim of its own, which lifts
// with it. The ring's fill changes to the page's text colour over that same duration,
// from the theme's on the blank page.
const page = `> :not(.prism-backdrop__canvas, .prism-backdrop__progress)`

export const backdropStyles = `
@property --_prism-page-fg {
  syntax: '<color>';
  inherits: true;
  initial-value: transparent;
}

@property --_prism-page-bg {
  syntax: '<color>';
  inherits: true;
  initial-value: transparent;
}

@property --_prism-page-glass {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

@property --_prism-page-dimmest {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

@property --_prism-page-pill-opacity {
  syntax: '<number>';
  inherits: true;
  initial-value: 0.45;
}

@property --_prism-page-light {
  syntax: '<number>';
  inherits: true;
  initial-value: 1;
}

:where(:root) {
  --prism-backdrop-fg: #111318;
  --prism-backdrop-bg: #f3f4f6;
  --prism-backdrop-alt-fg: #eceef2;
  --prism-backdrop-alt-bg: #24272e;
  --prism-backdrop-accent: #6d7cff;
  --prism-backdrop-page-in-duration: 200ms;
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --prism-backdrop-fg: #eceef2;
    --prism-backdrop-bg: #24272e;
    --prism-backdrop-alt-fg: #111318;
    --prism-backdrop-alt-bg: #f3f4f6;
    --prism-backdrop-accent: #9aa5ff;
  }
}

:where(.prism-backdrop) {
  position: relative;
  background-position: center;
  background-size: cover;
  background-attachment: fixed;
}

.prism-backdrop { isolation: isolate; }

.prism-backdrop--colours-fade {
  transition-property:
    --_prism-page-fg, --_prism-page-bg, --_prism-page-glass, --_prism-page-dimmest, --_prism-page-pill-opacity,
    --_prism-page-light;
  transition-duration: var(--prism-fade-background-duration);
  transition-timing-function: var(--prism-ease-in-out);
}

.prism-backdrop__canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  display: block;
  pointer-events: none;
  visibility: hidden;
}

.prism-backdrop--drawing > .prism-backdrop__canvas { visibility: visible; }

.prism-backdrop--waiting ${page} { opacity: 0; }

.prism-backdrop--sealed ${page} { visibility: hidden; }

.prism-backdrop--arriving ${page} {
  transition: opacity var(--prism-backdrop-page-in-duration) var(--prism-ease-out);
}

.prism-backdrop__progress--clear { --prism-progress-dim: transparent; }

.prism-progress-overlay.prism-backdrop__progress--clear[open] {
  transition-duration: var(--prism-fade-background-duration);
}

.prism-backdrop__progress--clear .prism-progress__glass::after,
.prism-backdrop__progress .prism-progress__spin::before {
  transition: background-color var(--prism-fade-background-duration) var(--prism-ease-in-out);
}
`
