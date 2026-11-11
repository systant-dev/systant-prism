import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BackdropScene } from '../renderer'
import { skyScene, type SkyMaker } from './skyScene'

const OSLO = { latitude: 59.9, longitude: 10.8 }
const make = vi.fn<() => Promise<BackdropScene>>(() => Promise.resolve({ render: () => {}, dispose: () => {} }))

/** Loads `made`, as a scene's module would. */
const loader = (made: SkyMaker) => vi.fn<() => Promise<SkyMaker>>(() => Promise.resolve(made))

afterEach(() => make.mockClear())

describe('skyScene', () => {
  it('loads what makes it only once it is wanted, and only once', async () => {
    const load = loader(make)
    const scene = skyScene(OSLO, load)
    expect(load).not.toHaveBeenCalled()
    await scene({} as GPUDevice)
    await scene({} as GPUDevice)
    expect(load).toHaveBeenCalledOnce()
    expect(make).toHaveBeenCalledTimes(2)
  })

  it('starts loading when preloaded, ahead of being made', async () => {
    const load = loader(make)
    const scene = skyScene(OSLO, load)
    scene.preload!()
    expect(load).toHaveBeenCalledOnce()
    await scene({} as GPUDevice)
    expect(load).toHaveBeenCalledOnce()
  })

  it('loads again after a load that failed, and a failed preload throws nothing', async () => {
    const load = loader(make).mockRejectedValueOnce(new Error('Offline'))
    const scene = skyScene(OSLO, load)
    scene.preload!()
    await expect(scene({} as GPUDevice)).rejects.toThrow('Offline')
    await scene({} as GPUDevice)
    expect(make).toHaveBeenCalledOnce()
  })

  it('makes nothing once it is no longer wanted by the time it has loaded', async () => {
    const stop = new AbortController()
    stop.abort(new Error('Not wanted'))
    await expect(skyScene(OSLO, loader(make))({} as GPUDevice, stop.signal)).rejects.toThrow('Not wanted')
    expect(make).not.toHaveBeenCalled()
  })

  it('makes the scene at its place, by its clock', async () => {
    const now = () => new Date('2026-03-20T12:00:00Z')
    await skyScene({ ...OSLO, now }, loader(make))({} as GPUDevice)
    expect(make).toHaveBeenCalledWith({}, OSLO, now, expect.anything())
  })

  it('lets go of all that was made, if making the scene fails', async () => {
    const destroy = vi.fn<() => void>()
    const failing = vi.fn<(...args: Parameters<SkyMaker>) => Promise<BackdropScene>>((_, __, ___, kept) => {
      kept.keep({ destroy })
      return Promise.reject(new Error('Refused'))
    })
    await expect(skyScene(OSLO, loader(failing))({} as GPUDevice)).rejects.toThrow('Refused')
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('gives up at the next pause once it is no longer wanted', async () => {
    const stop = new AbortController()
    const giving = vi.fn<(...args: Parameters<SkyMaker>) => Promise<BackdropScene>>(async (_, __, ___, kept) => {
      stop.abort(new Error('Not wanted'))
      await kept.pause()
      return { render: () => {}, dispose: () => {} }
    })
    await expect(skyScene(OSLO, loader(giving))({} as GPUDevice, stop.signal)).rejects.toThrow('Not wanted')
  })

  it('says whether it is night by its clock, or at a time it is given', () => {
    const scene = skyScene({ ...OSLO, now: () => new Date('2026-03-20T00:00:00Z') }, loader(make))
    expect(scene.isNight!()).toBe(true)
    expect(scene.isNight!(new Date('2026-03-20T12:00:00Z'))).toBe(false)
  })

  it('says so for its own place, not the one the browser seems to be in', () => {
    const noonInLondon = new Date('2026-03-20T12:00:00Z')
    expect(skyScene({ latitude: -33.9, longitude: 151.2 }, loader(make)).isNight!(noonInLondon)).toBe(true)
    expect(skyScene({ latitude: 51.5, longitude: -0.1 }, loader(make)).isNight!(noonInLondon)).toBe(false)
  })
})
