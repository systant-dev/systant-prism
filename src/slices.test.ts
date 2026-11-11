/// <reference types="vite/client" />
import { describe, expect, it, vi } from 'vitest'

// Some slices import each other in a ring: the backdrop shows a ProgressOverlay while a
// scene loads, whose glass is a popup's, on a card's styles, and all three use the
// backdrop's hooks. That does no harm while what one takes from another is only used
// once a component renders. Used as a module is first run, it would depend on which
// slice a page happened to import first, and fail for some. So each is imported first
// here, with nothing loaded before it.
const slices = import.meta.glob(['./components/*/index.ts', './effects/*/index.ts', './contrast/index.ts'])

describe('every slice', () => {
  it('is found', () => {
    expect(Object.keys(slices).length).toBeGreaterThan(20)
  })

  it.each(Object.keys(slices))('%s can be the first thing a page imports', async (slice) => {
    vi.resetModules()
    await expect(slices[slice]()).resolves.toBeDefined()
  })
})
