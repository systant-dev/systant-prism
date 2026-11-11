import { afterEach, describe, expect, it, vi } from 'vitest'
import { keeper, nextTask } from './kept'

describe('keeper', () => {
  it('destroys all it kept once released', () => {
    const kept = keeper({} as GPUDevice)
    const destroy = vi.fn<() => void>()
    kept.keep({ destroy })
    kept.keep({ destroy })
    expect(destroy).not.toHaveBeenCalled()

    kept.release()
    expect(destroy).toHaveBeenCalledTimes(2)
  })

  it('destroys at once what is made after it has let go', () => {
    const kept = keeper({} as GPUDevice)
    kept.release()
    const destroy = vi.fn<() => void>()
    kept.keep({ destroy })
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('pauses for the tasks that are waiting, and gives up once it is no longer wanted', async () => {
    const wanted = new AbortController()
    const kept = keeper({} as GPUDevice, wanted.signal)
    const order: string[] = []
    const waiting = nextTask().then(() => order.push('the task waiting'))
    await kept.pause()
    order.push('what follows the pause')
    await waiting
    expect(order).toEqual(['the task waiting', 'what follows the pause'])

    wanted.abort(new Error('No longer wanted'))
    await expect(kept.pause()).rejects.toThrow('No longer wanted')
  })
})

describe('nextTask', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('ends the task without waiting on a timer, which would be held to 4 ms or more', async () => {
    vi.useFakeTimers()
    let later = false
    void Promise.resolve().then(() => (later = true))
    const next = nextTask()
    expect(later).toBe(false)
    // No timer is run: one it had set would never come.
    await next
    expect(later).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('falls back on a timer where there are no messages to send', async () => {
    vi.stubGlobal('MessageChannel', undefined)
    vi.useFakeTimers()
    let done = false
    void nextTask().then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })
})
