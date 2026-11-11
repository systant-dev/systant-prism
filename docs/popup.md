# Popup

[← Back to the README](../README.md)

A floating glass panel shown over everything else on the page. It is a native popover, so the browser puts it in the top layer, where no `z-index` can cover it. It is controlled: `open` shows it, and `onClose` is called when it should close, which is on Escape or on a press outside both the popup and its anchor element. A popup rendered inside another counts as part of it, and Escape closes the innermost one first.

```tsx
import { Button, Popup } from '@systant/prism'

const button = useRef<HTMLButtonElement>(null)
const [open, setOpen] = useState(false)

<Button ref={button} onClick={() => setOpen(!open)}>Options</Button>
<Popup open={open} onClose={() => setOpen(false)} anchor={button}>
  …
</Popup>
```

- **Position.** It opens on the `side` of the anchor you ask for, unless it would overflow there and the opposite side has more room; `align` is swapped in the same way. It is kept at least 8px inside the window, and follows its anchor as the page scrolls or anything resizes.
- **Focus.** It doesn't take the focus when it opens, though its content can. If Escape closes it while the focus is inside it, the focus returns to where it was before the popup opened.
- **Content.** Its content stays mounted while it is closed.
- **Glass.** Inside a `GlassBackdrop` its glass shows the backdrop's image only, not any page content that lies between the image and the popup.

Takes every `<div>` prop except `popover`, including `ref`. It also takes:

| Prop           | Default    |                                                                                                                                  |
| -------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `open`         |            | Whether it is shown. It fades in and out as this changes.                                                                        |
| `onClose`      |            | Called when it should close: on Escape, or on a press outside both the popup and its anchor element.                             |
| `anchor`       |            | What it opens beside or at: a ref to an element, or a point `{ x, y }` in viewport px.                                           |
| `side`         | `'bottom'` | Which side of the anchor it opens on, if it fits there: `'top'`, `'bottom'`, `'left'`, `'right'`.                                |
| `align`        | `'start'`  | Which part of that side of the anchor it lines up with: `'start'`, `'center'` or `'end'`.                                        |
| `offset`       |            | The gap between it and the anchor, in px: 8 beside an element, 0 at a point.                                                     |
| `alignOffset`  | `0`        | Shifts it along the anchor from where `align` puts it, in px: inwards from that edge, or outwards past it with a negative value. |
| `padding`      | `'sm'`     | The same as a [Card](card.md)'s.                                                                                                 |
| `highlight`    | `true`     | Lights up the rim near the pointer, as on a card's border.                                                                       |
| `refract`      | `true`     | Glass effect: inside a `GlassBackdrop`, blurs the backdrop image behind it and bends it at the edges.                            |
| `readableText` | `true`     | Automatic text colour (see [Readable text colour](colours.md#readable-text-colour)).                                             |

| Property                      | Default                 |                                                                                                                                                                     |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--prism-popup-glass-opacity` | `0.45`                  | Opacity of the tint. Inside a `GlassBackdrop`, no lower than the page's text needs (see [One set of colours for a page](colours.md#one-set-of-colours-for-a-page)). |
| `--prism-popup-blur`          | `6px`                   | Blur of what is behind it.                                                                                                                                          |
| `--prism-popup-shadow`        |                         | Its drop shadow.                                                                                                                                                    |
| `--prism-popup-in-duration`   | `200ms`                 | How long it takes to fade in.                                                                                                                                       |
| `--prism-popup-in-easing`     | `var(--prism-ease-out)` | Easing of the fade in.                                                                                                                                              |
| `--prism-popup-out-duration`  | `150ms`                 | How long it takes to fade out.                                                                                                                                      |
| `--prism-popup-out-easing`    | `var(--prism-ease-in)`  | Easing of the fade out.                                                                                                                                             |

`placePopup(anchor, size, viewport, { side, align, offset, alignOffset, margin })` is the positioning logic on its own, for a component of yours that should open the same way. Given the anchor's rectangle, the popup's size and the viewport's size, all in px, it returns the popup's top-left corner and the side of the anchor it was placed on. An anchor with no width or height is a point.
