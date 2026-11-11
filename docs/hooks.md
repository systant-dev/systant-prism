# Hooks

[← Back to the README](../README.md)

The card's and button's effects are also available for your own elements. Each takes a ref and an `enabled` flag, and returns what to add to the element:

```tsx
import { useBackdropLens, useInnerSheen } from '@systant/prism'

function Panel({ children }) {
  const ref = useRef<HTMLDivElement>(null)
  const sheen = useInnerSheen(ref)
  useBackdropLens(ref)
  return (
    <div ref={ref} className={sheen.className}>
      {children}
      {sheen.element}
    </div>
  )
}
```

| Hook              |                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useInnerSheen`   | A sheen inside the edges nearest the pointer. It uses the element's `::after`.                                                                                                                                                                                                                                                                                                                   |
| `useGlare`        | A soft glare that follows the pointer while it is over the element. The glare is a separate element (`glare.element`, rendered after the content), so `::before` and `::after` remain free.                                                                                                                                                                                                      |
| `useEdgeLight`    | Lights the element's edge near the pointer, as on a card's border, with a separate element (`edge.element`). A third argument, `following`, set to `false`, keeps the ring lit as it is without following the pointer, which suits an element that is fading out.                                                                                                                                |
| `useBackdropLens` | Makes the nearest `GlassBackdrop` draw glass for the element, and returns whether it is doing so. The element must provide its own translucent background.                                                                                                                                                                                                                                       |
| `usePress`        | Makes an element look pressed into the surface while it is pressed, as a button does. It takes no ref: add `press.className` to the element and render `press.element` inside it, after its children. `usePress({ pressed: true })` holds it pressed, and `tint: true` darkens its glass as well. If the element has transitions of its own, include `pressTransition` in its `transition` list. |
