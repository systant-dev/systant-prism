# ScrollArea

[← Back to the README](../README.md)

A box whose content scrolls behind thin glass scrollbars: no track or arrows, just a slim translucent thumb. Where content is cut off, it fades out over the last 32px before the edge, instead of ending in a hard line; an edge with nothing more to scroll to doesn't fade.

Its props are applied to the area, the box that takes part in the page's layout; its children are placed in a viewport that fills the area and scrolls. Give the area a height (or a flex or max-height), and put any padding on a child:

```tsx
<ScrollArea style={{ height: 320 }}>
  <div style={{ padding: 20 }}>…</div>
</ScrollArea>
```

Takes every `<div>` prop, including `ref` (which refers to the area); `onScroll` is attached to the viewport. It also takes:

| Prop          | Default |                                                                                            |
| ------------- | ------- | ------------------------------------------------------------------------------------------ |
| `axis`        | `'y'`   | Which way it scrolls: `'y'`, `'x'` or `'both'`. Content is clipped in the other direction. |
| `fade`        | `true`  | Fade the content out where it is cut off.                                                  |
| `viewportRef` |         | A ref to the viewport, the element that scrolls, for calling `scrollTo` and the like.      |

| Property                        | Default                |                                                                                                |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| `--prism-scrollbar-thumb`       | `rgb(17 19 24 / 0.28)` | Colour of the thumb (white at the same opacity in dark mode).                                  |
| `--prism-scrollbar-thumb-hover` | `rgb(17 19 24 / 0.45)` | Colour of the thumb while the pointer is over the scroller.                                    |
| `--prism-scroll-fade-size`      | `32px`                 | How far in from a cut-off edge the content fades.                                              |
| `--prism-scroll-area-bar-inset` | `--prism-card-radius`  | How far each scrollbar stops short of the corners, so that it clears a card's rounded corners. |

`useScrollFade(ref)` applies the same fade to a scrolling element of your own, without the scrollbars. It works by masking the element, which also hides the element's own `box-shadow` and `outline`.
