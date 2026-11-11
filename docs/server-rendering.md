# Server rendering

[← Back to the README](../README.md)

Every component can be rendered on a server. The package is marked `'use client'`, so a React Server Components framework such as Next.js's App Router loads it as client code, and a server component can render its components (passing them only data, not functions). Three things are known only to the browser, so the server renders without them: the reader's language, the page's colours for the backdrop, and whether it is night. Each can be worked out on the server and passed in. The examples use Next.js, but none of this requires it.

`@systant/prism/server` exports what a server needs for this. It doesn't import React or touch a DOM, so it runs in a server component, a route handler or a build script.

## The Calendar's language

The server can pass on the language the browser asked for. A calendar that is given a `locale` keeps it, and doesn't switch to the browser's language afterwards.

```tsx
// app/page.tsx, a server component
import { headers } from 'next/headers'
import { DeliveryDate } from './DeliveryDate'

export default async function Page() {
  const language = (await headers()).get('accept-language')?.split(/[,;]/)[0]
  return <DeliveryDate locale={language || undefined} />
}
```

```tsx
// app/DeliveryDate.tsx
'use client'
import { useState } from 'react'
import { Calendar } from '@systant/prism'

export function DeliveryDate({ locale }: { locale?: string }) {
  const [date, setDate] = useState<Date | null>(null)
  return <Calendar locale={locale} value={date} onChange={setDate} />
}
```

## The backdrop's colours

The page's colours are chosen from the image (see [One set of colours for a page](colours.md#one-set-of-colours-for-a-page)) once the GPU has drawn it, so a page starts in the theme's own colours and changes to the image's a moment later. `samplePicture` works out the same colours from the decoded picture, once, on the server or at build time. Pass the result as `pageImage`, and `nightPageImage` for `nightSrc`:

```ts
// lib/pageImage.ts, run on the server
import sharp from 'sharp'
import { samplePicture } from '@systant/prism/server'

export async function pageImageOf(file: string) {
  const { data, info } = await sharp(file).resize(64, 64, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true })
  return samplePicture({ data, width: info.width, height: info.height })
}
```

```tsx
// app/page.tsx, a server component
import { GlassBackdrop } from '@systant/prism'
import { pageImageOf } from '@/lib/pageImage'

export default async function Page() {
  return (
    <GlassBackdrop src="/ocean.webp" pageImage={await pageImageOf('public/ocean.webp')}>
      …
    </GlassBackdrop>
  )
}
```

`samplePicture` takes RGB or RGBA pixels of any size and works from its own copy, at most 64 px on a side, so resizing the picture first only saves time. Transparent pixels are composited over white. The result is plain data, so it can be passed to a client component.

The colours are applied when the page hydrates, before anything is drawn; the server's markup is sent without them, because they also depend on the theme's colours, which only the browser's CSS can resolve. They remain in use where the image can't be drawn or read (no WebGPU, or a cross-origin image without CORS headers), and a scene's own colours replace them once the scene is showing.

## Day or night

A scene decides whether it is night from the reader's clock, which the server doesn't have. So the server renders `src`, and a page opened at night shows the daytime picture until it hydrates. A server that knows roughly where the reader is can work out whether it is night there with `isNightAt`, and pass the result as `initialNight`. On Vercel, the request's headers give the location:

```tsx
// app/page.tsx, a server component
import { headers } from 'next/headers'
import { isNightAt } from '@systant/prism/server'
import { Backdrop } from './Backdrop'

export default async function Page() {
  const request = await headers()
  const latitude = request.get('x-vercel-ip-latitude')
  const longitude = request.get('x-vercel-ip-longitude')
  const place = latitude && longitude ? { latitude: Number(latitude), longitude: Number(longitude) } : undefined
  return <Backdrop place={place} initialNight={place ? isNightAt(place) : false} />
}
```

```tsx
// app/Backdrop.tsx
'use client'
import { useMemo } from 'react'
import { createOceanScene, GlassBackdrop } from '@systant/prism'
import type { Place } from '@systant/prism/server'

export function Backdrop({ place, initialNight }: { place?: Place; initialNight: boolean }) {
  const { latitude, longitude } = place ?? {}
  const ocean = useMemo(() => createOceanScene({ latitude, longitude }), [latitude, longitude])
  return <GlassBackdrop src="/ocean.webp" nightSrc="/ocean-night.webp" scene={ocean} initialNight={initialNight} />
}
```

Give the scene the same location, so that it agrees with the server. Once the page has hydrated, the scene itself decides whether it is night. Reading the request's headers makes the page render on every request, rather than once at build time.
