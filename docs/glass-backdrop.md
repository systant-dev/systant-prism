# GlassBackdrop

[← Back to the README](../README.md)

All glass is drawn on the GPU, by a `GlassBackdrop`, from a background image you supply. Render your page inside one, and every component with glass gets its blur and edge bend from the image. Outside a `GlassBackdrop`, components have no glass, only their translucent tint:

```tsx
import { Card, GlassBackdrop } from '@systant/prism'

export function Page() {
  return (
    <GlassBackdrop src="/background.webp" style={{ minHeight: '100vh' }}>
      <Card>Hello</Card>
    </GlassBackdrop>
  )
}
```

The image covers the viewport and stays put as the page scrolls, like `background: url() center / cover fixed`. A new `src` crossfades in over the old image once it has loaded, over `--prism-fade-background-duration` (`450ms`; `0s` switches immediately). `GlassBackdrop` takes every `<div>` prop.

Limits:

- Only the image is refracted. Other content between the image and a card (text, another panel) shows through the card unblurred.
- A `Popup` is drawn above the page, so its glass shows only the image, not a card that lies under it. Glass inside a popup has only its tint.
- Cross-origin images need CORS headers.
- The glass is redrawn when the page scrolls, the window or a card resizes, or a card re-renders or moves. A card moved by a CSS animation or transition may leave its glass trailing behind it until it stops.
- Glass fades with the opacity of its card and the card's ancestors, following an opacity transition frame by frame. An opacity animation (rather than a transition) is caught only when something else redraws.
- An image with transparency shows the background colour of the `GlassBackdrop`, or failing that of what is behind it, or failing that white. A pattern or gradient behind the image doesn't show through.
- Without WebGPU, or until the GPU is ready and the image has loaded, the image is a plain CSS background and nothing has glass. If the GPU is lost, it goes back to that background and keeps asking for a new device until one is ready.

## An animated background

Pass a `scene` and the GPU draws that in place of the image, frame after frame, with all the glass refracting it as it moves. `oceanScene` is an ocean and `forestScene` a wooded hillside, both by day and by night, by the local time:

```tsx
import { Card, GlassBackdrop, oceanScene } from '@systant/prism'

export function Page() {
  return (
    <GlassBackdrop src="/ocean.webp" nightSrc="/ocean-night.webp" scene={oceanScene} style={{ minHeight: '100vh' }}>
      <Card>Hello</Card>
    </GlassBackdrop>
  )
}
```

[`DynamicBackground`](dynamic-background.md) is this ready-made, with its pictures included. With your own `GlassBackdrop`:

- `src` should be a picture of the scene: it is shown wherever the scene can't be drawn. Left out, the page's own background shows there. `nightSrc` is a night-time picture, shown instead while the scene reports that it is night.
- Once the scene is showing, the page's colours are chosen from the scene itself, every 30 seconds, so text stays readable as day turns to night.
- Pass the same `scene` function on every render, because a new function counts as a new scene. A new scene crossfades in as a new image does.

**Waiting for the scene.** A scene takes a moment to build (seconds, the first time), so the page waits for it, both when it first loads and each time `scene` changes, showing a [`ProgressOverlay`](progress.md#over-the-whole-page) ring. On the first load, everything inside the `GlassBackdrop` is hidden until the scene has faded in; after that, the page stays visible under the ring's dimming. Server-rendered markup leaves the content visible, so that it can be read without scripts, and hides it only once the page hydrates.

A background never stops the page from being used. If the scene can't be built, there is no WebGPU, or the GPU is lost, the page stops waiting and carries on with the picture. It also stops waiting after 10 seconds; if the scene becomes ready later, it fades in under the page.

| Prop             | Default   |                                                                                                                                                                                           |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`            |           | The image. With a scene, a picture of it.                                                                                                                                                 |
| `scene`          |           | The scene to draw in place of the image.                                                                                                                                                  |
| `nightSrc`       |           | A night-time picture of the scene.                                                                                                                                                        |
| `sceneTime`      |           | The moment to show, a `Date`, instead of the scene's own time.                                                                                                                            |
| `still`          |           | Holds the scene as a single frame, redrawn once a minute or when `sceneTime` changes. `false` keeps it moving whatever the system setting. Left out, it follows `prefers-reduced-motion`. |
| `rain`           | `false`   | Whether it rains.                                                                                                                                                                         |
| `waitForScene`   | `true`    | Whether the page waits for a scene, showing a ring. With `false`, the page and the picture appear immediately, and the scene crossfades in under them when it is ready.                   |
| `loadingLabel`   | `Loading` | The ring's accessible name.                                                                                                                                                               |
| `pageImage`      |           | The page's colours for `src`, worked out in advance, so that the page has them before anything is drawn (see [Server rendering](server-rendering.md)).                                    |
| `nightPageImage` |           | The same for `nightSrc`.                                                                                                                                                                  |
| `initialNight`   | `false`   | Whether it is night in the scene when the page first renders. A server that knows this can set it to render `nightSrc` from the start (see [Server rendering](server-rendering.md)).      |

**The sky.** Both scenes share one sky. The sun rises and sets in the middle of the view at the real times for the place, and the moon takes its place through the night. Neither is at its true position, and the moon is always shown full. The light follows the real height of the sun, so the sky reddens around the real sunset and is fully dark when the sun is about 6° below the horizon. By night the brightest stars and the Milky Way are where they really are for the time and place; the faint stars are generated, so only the brightest can be picked out by name. Clouds drift across both scenes, lit by the sky they are in.

**Location.** Sunrise and sunset depend on where the viewer is, and asking the browser would mean a permission prompt. So a scene guesses the location from the browser's time zone, which is accurate to within a few minutes for the time zones in its list of cities, and rougher elsewhere. For exact times, pass the location:

```tsx
import { createOceanScene } from '@systant/prism'

// Made once, outside the component.
const ocean = createOceanScene({ latitude: 55.95, longitude: -3.19 })
```

`createOceanScene` and `createForestScene` also take `now`, a function that returns the time to show.

**Time and motion.** To let the user choose the time, and whether the scene moves, use `sceneTime` and `still`:

```tsx
<GlassBackdrop src="/ocean.webp" scene={oceanScene} sceneTime={evening} still={!animations}>
  <Card>Hello</Card>
</GlassBackdrop>
```

The sky jumps straight to `sceneTime` and the page's colours follow, so it can be driven by a slider. When `still` changes, the scene eases to a stop, or back up to speed, over a second and a half (immediately with `prefers-reduced-motion`).

**Rain.** Set `rain`, and over about four seconds the sky clouds over and the rain starts, or the sky clears; the scene isn't rebuilt. On the ocean, drops set off rings and splashes and the water loses most of its glitter; in the forest, wet leaves go darker and shinier and the far side of the valley fades into the air.

**The ocean** is a Tessendorf FFT simulation in six cascades of 256×256 samples, covering wavelengths from about a kilometre down to a few millimetres, on a surface that reaches 160 km. **The forest** is real leaves rather than a picture of them: about 80 million, drawn once as the scene is made and then lit each frame for the time of day, so its detail costs nothing per frame. Its wind is simulated, with trunks and limbs that bend as beams do.

What they cost, measured on an NVIDIA GTX 10-series desktop GPU by the GPU's own timers (expect several times as much on an integrated GPU):

- The ocean took 0.9 to 1.9 ms of GPU time a frame from 720p to 1440p, and the forest 0.6 to 1.8 ms in the same runs, with the glass of the page on top of that. Rain added about 0.75 ms a frame to the ocean and 0.5 ms to the forest at 1080p, and costs nothing while it is off.
- Making the forest took about 1 s. It keeps about 135 MB of GPU memory, whatever the size of the page, and needs about 100 MB more while it is being made.
- A scene is held to 60 frames a second on average, however fast the display, and is drawn at no more than 1440p's pixels. If the GPU still can't keep up, the scene drops its resolution, in steps down to half, which costs sharpness rather than the page's frames.
- Rendering stops while the tab is hidden, and with `prefers-reduced-motion` or `still` the scene is a still image, redrawn once a minute.

**Your own scene.** To draw something else, write a scene: a function that receives the `GPUDevice` and resolves to an object with `render` and `dispose`. If its promise rejects, the image is shown instead. Each frame's data includes `seconds` and `delta`, which a scene should animate from so that it eases with `still`, and `rain`, which it is free to ignore.
