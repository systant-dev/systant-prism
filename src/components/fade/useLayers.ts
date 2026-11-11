import { useState, type Key, type ReactNode } from 'react'

/**
 * How new content replaces the old: `layer` fades the old out, and the new in
 * as the old is nearly gone; `background` fades the new in over the old, which
 * stays until covered.
 */
export type FadeMode = 'layer' | 'background'

export interface Layer {
  /** Its own: a key can come back as a new layer while its old one is still going. */
  id: number
  key: Key
  /** The latest content for the key, or, once replaced, the last. */
  content: ReactNode
  /**
   * in: fading in. shown: showing, the first without a fade. out: fading out
   * as the next comes in (layer). under: left as it is under the next, until
   * covered (background).
   */
  state: 'in' | 'shown' | 'out' | 'under'
}

export interface Layers {
  /** The layers to render, oldest first. */
  layers: Layer[]
  /** Settles a layer once its fade has ended: one faded out goes, and one faded in covers those under it. */
  faded(id: number): void
}

let serial = 0

function layer(key: Key, content: ReactNode, state: Layer['state']): Layer {
  return { id: ++serial, key, content, state }
}

function isCurrent({ state }: Layer) {
  return state === 'in' || state === 'shown'
}

/** The layers once `key` shows `content`, by `mode`. */
function show(layers: Layer[], key: Key, content: ReactNode, mode: FadeMode): Layer[] {
  const old = mode === 'background' ? ('under' as const) : ('out' as const)
  return [...layers.map((l) => (isCurrent(l) ? { ...l, state: old } : l)), layer(key, content, 'in')]
}

/** The layers once `done` has faded, in or out. */
function settle(layers: Layer[], done: Layer): Layer[] {
  if (done.state === 'out') return layers.filter((l) => l !== done)
  // Faded in: what was under it is covered.
  return layers.flatMap((l) => (l === done ? [{ ...l, state: 'shown' as const }] : l.state === 'under' ? [] : [l]))
}

/**
 * The contents of a box while one replaces another, as layers, by `mode`.
 * While `key` stays the same its layer shows the latest content, updates and
 * all. Once it changes, that layer keeps the content it last had while it fades
 * out or lies under the new one.
 *
 * It knows nothing of how the layers look or how long they take: the caller
 * reports each fade's end through `faded`.
 */
export function useLayers(key: Key, content: ReactNode, mode: FadeMode): Layers {
  const [layers, setLayers] = useState<Layer[]>(() => [layer(key, content, 'shown')])

  const current = layers.find(isCurrent)
  if (current?.key !== key) setLayers(show(layers, key, content, mode))
  else if (current.content !== content) setLayers(layers.map((l) => (l === current ? { ...l, content } : l)))

  return {
    layers,
    faded: (id) =>
      setLayers((now) => {
        const done = now.find((l) => l.id === id)
        return done?.state === 'in' || done?.state === 'out' ? settle(now, done) : now
      }),
  }
}
