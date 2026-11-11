# Progress

[← Back to the README](../README.md)

A loading indicator: a ring of clear glass with a soft arc of colour, its fill, travelling round inside it.

```tsx
<Progress aria-label="Loading the report" />
```

It is an indeterminate `role="progressbar"`, named "Loading" unless you give it an `aria-label` or `aria-labelledby`. Put `aria-busy` on whatever is loading.

The rotation runs on the browser's compositor, with no JavaScript, so work on the main thread doesn't make it stutter. With `prefers-reduced-motion` the fill stays at the top and slowly pulses instead. In forced-colours mode the ring is outlined and the fill is the system's highlight colour.

The fill's colour follows the page: the page's text colour inside a `GlassBackdrop`, a colour adjusted, if need be, to stay visible on an opaque background, and `prefers-color-scheme` elsewhere. To give it your own colour, turn this off with `readableFill={false}` and set `--prism-progress-fill`.

Takes every `<div>` prop except `children`, including `ref`. It also takes:

| Prop           | Default |                                                     |
| -------------- | ------- | --------------------------------------------------- |
| `refract`      | `true`  | Bends what is behind the ring, as thick glass does. |
| `readableFill` | `true`  | Automatic fill colour, as described above.          |

| Property                         | Default        |                                                                                                           |
| -------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `--prism-progress-size`          | `120px`        | The ring's outer diameter.                                                                                |
| `--prism-progress-edge-soft`     | `1.5px`        | How soft the ring's edges are. `0px` makes them sharp.                                                    |
| `--prism-progress-thickness`     | `24px`         | Thickness of the ring.                                                                                    |
| `--prism-progress-duration`      | `1800ms`       | How long the fill takes to go round once or, with reduced motion, to fade out or back in.                 |
| `--prism-progress-appear`        | `150ms`        | How long the fill takes to fade in.                                                                       |
| `--prism-progress-arc`           | `45deg`        | The angle the fill covers, measured between the points where it is at half strength.                      |
| `--prism-progress-arc-fade`      | `34deg`        | The angle over which each end of the fill fades out, centred on its half-strength point. At most the arc. |
| `--prism-progress-fill`          | `#111318`      | Colour of the fill (`#eceef2` in dark mode).                                                              |
| `--prism-progress-fill-opacity`  | `0.8`          | Opacity of the fill at its strongest.                                                                     |
| `--prism-progress-fill-soft`     | `8px`          | How far the fill fades in from the inner and outer edges of the ring.                                     |
| `--prism-progress-bg`            | `#f3f4f6`      | Colour of the glass's tint (`#24272e` in dark mode).                                                      |
| `--prism-progress-glass-opacity` | `0.16`         | Opacity of the tint.                                                                                      |
| `--prism-progress-light`         | `1`            | Strength of the highlights on the glass, 0–1 (`0.6` on dark glass).                                       |
| `--prism-progress-shadow`        | soft layers    | The shadow round the ring.                                                                                |
| `--prism-progress-hole-shadow`   | `inset` shadow | The shadow the ring casts into its hole.                                                                  |

The ring sets `--prism-refraction` to `26%`, `--prism-refraction-blur` to `1px` and `--prism-refraction-frost` to `6px`: its lower part bends what is behind it, and its top only blurs.

## Over the whole page

`ProgressOverlay` puts the ring in the middle of the viewport, with everything under it dimmed, for when the page can't be used until something has finished:

```tsx
<ProgressOverlay open={saving} aria-label="Saving your changes" />
```

Keep it mounted and change `open`, so that the ring and the dimming can fade in and out. It is a modal `<dialog>`: while it is open the rest of the page can't be reached by the pointer, the keyboard or assistive technology, and when it closes the focus returns to where it was. The user can't dismiss it (Escape does nothing, though `onCancel` is still called), so make sure `open` always becomes false in the end, including when the thing it is waiting for fails.

Inside a `GlassBackdrop` the ring's glass shows the backdrop image only, as a [`Popup`](popup.md)'s does: a card under the ring doesn't show through it.

Takes every `<dialog>` prop except `children` and `open`, including `ref`. It also takes:

| Prop           | Default |                              |
| -------------- | ------- | ---------------------------- |
| `open`         |         | Whether it is shown.         |
| `refract`      | `true`  | The same as on a `Progress`. |
| `readableFill` | `true`  | The same as on a `Progress`. |

| Property                                | Default             |                                               |
| --------------------------------------- | ------------------- | --------------------------------------------- |
| `--prism-progress-dim`                  | `rgb(0 0 0 / 0.25)` | The colour that dims the page.                |
| `--prism-progress-dim-duration`         | `250ms`             | How long the dimming takes to fade in or out. |
| `--prism-progress-dim-easing`           | ease-in-out         | Easing of that fade.                          |
| `--prism-progress-overlay-in-duration`  | `150ms`             | How long the ring takes to fade in.           |
| `--prism-progress-overlay-in-easing`    | ease-out            | Easing of the ring's fade in.                 |
| `--prism-progress-overlay-out-duration` | `120ms`             | How long the ring takes to fade out.          |
| `--prism-progress-overlay-out-easing`   | ease-in             | Easing of the ring's fade out.                |
