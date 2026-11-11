// The rim shared by Button, Toggle, Textbox and Popup: a ring painted for .prism-rim (a
// span useRim renders) and masked by the span down to the ring,
// --prism-button-rim-width wide, so it never shows through the glass. The span
// takes its corners from its host, corner-shape included, so it follows a
// popup's squircles.
//
// It is lit in one of two ways, by where it lies: raised off a card, and soft
// on a card. A toggle's or a textbox's own rim is always soft. Both are conic gradients round
// the host's centre, smooth all the way round with no patches.
//
// The raised light, off a card, is lit on the diagonal from above left. It is
// bright round the top-left, fading to a dark stretch across the top-right,
// bright again (a little less) round the bottom-right, and dark across the
// bottom-left, though less so than the top-right: a drop shadow just below adds
// its own dark there, so the same shade would look heavier.
// --prism-button-rim-angle turns it; by default its bright spots sit a little
// round from the corners, so on a button they lie near the highlights inside
// the rim (src/components/button/styles/highlights.styles.ts) without lining up
// with them.
//
// The soft light, on a card, is lit from straight above, as the card itself is
// (its sheen along the top edge, its shadow below), and has no dark at all.
// The raised light's diagonal disagrees with the card's light: on a pale card
// its bright stretches melt into the card and its dark ones stand out as bars,
// and any light that is brighter on one side than the other reads as the host
// leaning. So the soft light is the same on the left as on the right. A
// toggle's track is a long, low capsule, on which the raised light's diagonal
// reads as a slope even off a card, and as a groove in the surface it is lit
// from above like the card around it anyway, so it takes the soft light
// wherever it lies, and a textbox, as long and low and sunk as it, likewise.
// The whole top edge is evenly bright (--prism-toggle-rim-light), fading round
// each end to a dimmer light halfway down (-rim-side), and on to a dimmer one
// still (-rim-bottom) along the whole bottom edge. The angle round from the top
// at which a straight edge gives way to an end, -curve below, is worked out
// from the rim's size as atan2(width less height, height), so on a capsule (a
// toggle, or a button at its usual height) the fades keep to the ends at any
// width or height. The span is a size container, and its content box is a
// rim's width in from the host's edge all round, which leaves the angle all
// but the same.
//
// The tokens keep the names of the hosts each light came from: the raised
// light's are the button's, --prism-button-rim-*, and the soft light's the
// toggle's, --prism-toggle-rim-*. A theme that restyles buttons' rims restyles
// every rim off a card but a toggle's, and one that restyles toggles' rims
// every toggle's and every rim on a card. The width, the turn and the timing of the turn are the button's for
// both.
//
// A card hands the soft light down to every rim inside it as
// --_prism-rim-paint, an inherited image that takes the raised light's place,
// and a toggle or a textbox hands it to its own.
// It is passed down unresolved, so its cq units are worked out on each rim,
// from that rim's own size. A popup is a card's glass too, so what lies on it
// is lit softly, but its own rim, floating over the page in the top layer, is
// raised even when the popup sits inside a card in the document. The leading
// underscore marks the property as internal, not a tuning property.
//
// A rim that turns (.prism-rim--turns) turns its shading clockwise by
// --prism-button-press-rim-turn while its host is pressed (the press's
// pressedState, src/effects/press), so the light on the left slides up and
// right and the light on the right slides down and left, quickly with the
// press's timing in force on the host, --_prism-press-duration and
// --_prism-press-easing, so its host must be a press. Let go, it turns back
// more slowly than the rest of the host settles, over
// --prism-button-rim-release-duration, so the light drifts home after the glass
// has come to rest. Its easing,
// --prism-button-rim-release-easing, is a steeper ease-out than the press's:
// most of the turn happens early and the rest creeps in over a long tail.
//
// The light is painted by the span's ::before. On a rim that turns it fills a
// square centred on the host, one and a half times its longer side across
// (sized in cqmax, from the span). That is more than the host's diagonal, so
// it covers the ring at any turn however wide or tall the host, and no more,
// since the square is kept on a layer of its own. The ring's shape stays put
// while the light moves round it. It turns by rotate, not by animating the
// gradient's angle: like the press's shrink, the browser runs it off the main
// thread without repainting anything, so the two keep in step and stay smooth
// however busy the page is. will-change keeps the gradient on its own layer,
// so a press needn't make one.
//
// A rim that never turns paints its light on a ::before just the span's size,
// with no square and no layer of its own, which on a host as large as a popup
// would cost a large layer for nothing.
//
// The tuning properties are set on :where(:root), so they can be overridden on
// the host or once on any ancestor.
import { pressedState } from '../press'

const raised = `conic-gradient(
    from var(--prism-button-rim-angle),
    var(--prism-button-rim-light),
    var(--prism-button-rim-shade) 25%,
    var(--prism-button-rim-bounce) 50%,
    var(--prism-button-rim-shade-bottom) 75%,
    var(--prism-button-rim-light)
  )`

// -curve is where the top edge gives way to the right end, round from the top;
// the soft light mirrors every stop about the top, so it is even side to side.
const curve = 'atan2(100cqw - 100cqh, 100cqh)'
const soft = `conic-gradient(
    var(--prism-toggle-rim-light),
    var(--prism-toggle-rim-light) ${curve},
    var(--prism-toggle-rim-side) 90deg,
    var(--prism-toggle-rim-bottom) calc(180deg - ${curve}),
    var(--prism-toggle-rim-bottom) calc(180deg + ${curve}),
    var(--prism-toggle-rim-side) 270deg,
    var(--prism-toggle-rim-light) calc(360deg - ${curve}),
    var(--prism-toggle-rim-light)
  )`

export const rimStyles = `
:where(:root) {
  --prism-button-rim-light: rgb(255 255 255 / 0.75);
  --prism-button-rim-shade: rgb(0 0 0 / 0.35);
  --prism-button-rim-shade-bottom: rgb(0 0 0 / 0.15);
  --prism-button-rim-bounce: rgb(255 255 255 / 0.5);
  --prism-button-rim-angle: -40deg;
  --prism-toggle-rim-light: rgb(255 255 255 / 0.85);
  --prism-toggle-rim-side: rgb(255 255 255 / 0.5);
  --prism-toggle-rim-bottom: rgb(255 255 255 / 0.3);
  --prism-button-rim-width: 1px;
  --prism-button-press-rim-turn: 45deg;
  --prism-button-rim-release-duration: 1400ms;
  --prism-button-rim-release-easing: var(--prism-ease-out-long);
}

:where(.prism-card, .prism-popup, .prism-toggle, .prism-textbox) { --_prism-rim-paint: ${soft}; }

:where(.prism-popup) > .prism-rim { --_prism-rim-paint: initial; }

.prism-rim {
  position: absolute;
  inset: 0;
  padding: var(--prism-button-rim-width);
  border-radius: inherit;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
  container-type: size;
}

.prism-rim::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--_prism-rim-paint, ${raised});
}

.prism-rim--turns::before {
  inset: auto;
  top: 50%;
  left: 50%;
  width: 150cqmax;
  height: 150cqmax;
  translate: -50% -50%;
  will-change: rotate;
  transition: rotate var(--prism-button-rim-release-duration) var(--prism-button-rim-release-easing);
}

${pressedState} > .prism-rim--turns::before {
  rotate: var(--prism-button-press-rim-turn);
  transition: rotate var(--_prism-press-duration) var(--_prism-press-easing);
}

@supports (corner-shape: squircle) {
  .prism-rim { corner-shape: inherit; }
}
`
