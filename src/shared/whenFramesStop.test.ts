import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manualFrames } from '../../test/dom'
import { whenFramesStop } from './whenFramesStop'

let frames: ReturnType<typeof manualFrames>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  frames = manualFrames()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function hide(hidden: boolean) {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden)
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('whenFramesStop', () => {
  it('says so once a whole wait goes by with no frame', () => {
    const stopped = vi.fn<() => void>()
    whenFramesStop(1000, stopped)
    vi.advanceTimersByTime(999)
    expect(stopped).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(stopped).toHaveBeenCalledOnce()
  })

  it('says nothing while frames come, however slowly', () => {
    const stopped = vi.fn<() => void>()
    whenFramesStop(1000, stopped)
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(900)
      frames.flush()
    }
    expect(stopped).not.toHaveBeenCalled()
  })

  it('says so once frames stop coming', () => {
    const stopped = vi.fn<() => void>()
    whenFramesStop(1000, stopped)
    vi.advanceTimersByTime(500)
    frames.flush()
    vi.advanceTimersByTime(500)
    expect(stopped).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(stopped).toHaveBeenCalledOnce()
  })

  it('asks for no more than one frame at a time', () => {
    whenFramesStop(1000, () => {})
    for (let i = 0; i < 5; i++) {
      expect(frames.pending).toBe(1)
      frames.flush()
      expect(frames.pending).toBe(0)
      vi.advanceTimersByTime(1000)
    }
  })

  it('counts no time the page is hidden, and starts the wait afresh as it comes back', () => {
    const stopped = vi.fn<() => void>()
    whenFramesStop(1000, stopped)
    hide(true)
    vi.advanceTimersByTime(60_000)
    expect(stopped).not.toHaveBeenCalled()

    hide(false)
    vi.advanceTimersByTime(1000)
    expect(stopped).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(stopped).toHaveBeenCalledOnce()
  })

  it('stops watching when told', () => {
    const stopped = vi.fn<() => void>()
    const stop = whenFramesStop(1000, stopped)
    stop()
    vi.advanceTimersByTime(5000)
    expect(stopped).not.toHaveBeenCalled()
    expect(frames.pending).toBe(0)
  })

  it('leaves nothing behind once it has said so', () => {
    const stopped = vi.fn<() => void>()
    const listening = vi.spyOn(document, 'removeEventListener')
    whenFramesStop(1000, stopped)
    vi.advanceTimersByTime(5000)
    expect(stopped).toHaveBeenCalledOnce()
    expect(frames.pending).toBe(0)
    expect(listening).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
