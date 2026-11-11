// What a scene has made on the GPU, so that all of it goes when the scene does, or when
// it fails or is given up on part of the way through being made, while the device lives on.

interface Made {
  destroy(): void
}

export interface Kept {
  /** Keeps something made on the GPU until `release`. Made after that, it goes at once. */
  keep<T extends Made>(made: T): T
  /** A buffer with `data` in it, to keep. */
  filled(label: string, data: ArrayBuffer | ArrayBufferView<ArrayBuffer>, usage: GPUBufferUsageFlags): GPUBuffer
  /** Lets the page paint while a scene is being made, and rejects if it is no longer wanted. */
  pause(): Promise<void>
  release(): void
}

/**
 * Ends the task under way, so that the page can paint and take input before what
 * follows: a message to itself, which is a task like any other and comes at once. A
 * timer set from a timer waits 4 ms or more, and a scene's build has dozens: a fifth of
 * the forest's went on waiting for them. Not scheduler.yield(), which comes back ahead
 * of the frame that is due: in Chrome, work in 8 ms stints with one between them let 6
 * frames through in 600 ms, and with a message or a timer between them 38.
 */
export function nextTask(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return new Promise((resolve) => setTimeout(resolve))
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel()
    port1.onmessage = () => {
      // Or, in Node, it would hold the process open.
      port1.close()
      resolve()
    }
    port2.postMessage(null)
  })
}

export function keeper(device: GPUDevice, signal?: AbortSignal): Kept {
  let made: Made[] | null = []

  function keep<T extends Made>(resource: T) {
    if (made) made.push(resource)
    else resource.destroy()
    return resource
  }

  return {
    keep,

    filled(label, data, usage) {
      const buffer = keep(device.createBuffer({ label, size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST }))
      device.queue.writeBuffer(buffer, 0, data)
      return buffer
    },

    async pause() {
      await nextTask()
      signal?.throwIfAborted()
    },

    release() {
      for (const resource of made ?? []) resource.destroy()
      made = null
    },
  }
}
