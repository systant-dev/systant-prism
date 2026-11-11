# DynamicBackground

[← Back to the README](../README.md)

An animated landscape behind the whole page: a forest or an ocean under the sky for the time and place, with the sun, moon, stars and Milky Way, drifting clouds and, if you ask for it, rain. It is a [`GlassBackdrop`](glass-backdrop.md) with a built-in scene, so all the glass inside it refracts the scene as it moves. It comes with a still picture of each scene by day and by night, shown wherever the scene can't be drawn (no WebGPU).

```tsx
import { Card, DynamicBackground } from '@systant/prism'

export function Page() {
  return (
    <DynamicBackground scene="forest" style={{ minHeight: '100vh' }}>
      <Card>Hello</Card>
    </DynamicBackground>
  )
}
```

| Prop        | Default   |                                                                                                                                                                |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scene`     | `'ocean'` | `'forest'` or `'ocean'`. A new one crossfades in over the last.                                                                                                |
| `animated`  |           | Whether the scene moves. With `false` it is held still and redrawn once a minute. Left out, it follows `prefers-reduced-motion`.                               |
| `rain`      | `false`   | Whether it rains. The sky clouds over and the rain starts, or clears, over a few seconds.                                                                      |
| `time`      |           | The time of day to show: a `Date`, or minutes past midnight today (0–1439), which suits a slider. Left out or `null`, it follows the local time.               |
| `latitude`  |           | The viewer's latitude in degrees, used with `longitude` for sunrise, sunset and the night sky. Left out, the location is guessed from the browser's time zone. |
| `longitude` |           | The viewer's longitude in degrees, positive to the east of Greenwich.                                                                                          |
| `src`       |           | A daytime picture to show where the scene can't be drawn, in place of the built-in one.                                                                        |
| `nightSrc`  |           | The same, for the night.                                                                                                                                       |

Every other `GlassBackdrop` prop (`waitForScene`, `loadingLabel`, `initialNight`) and every `<div>` prop is passed through. See [An animated background](glass-backdrop.md#an-animated-background) for what the scenes show, what they cost and how the page waits for them.

The built-in pictures are files in the package (`@systant/prism/pictures/*.webp`, about 780 kB together), referenced with `new URL('./pictures/…', import.meta.url)`, which Vite, webpack 5, Next.js and Parcel all turn into assets of your app, so only the picture being shown is downloaded. Server-rendered markup doesn't include them: they are added when the page hydrates. To serve pictures yourself, or to have one in the server's markup, pass `src` and `nightSrc`.
