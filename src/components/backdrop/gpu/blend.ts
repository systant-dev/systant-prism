/** A premultiplied colour drawn over what is under it. */
export const OVER: GPUBlendComponent = { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }

/** Leaves the target's alpha as it is, as a scene's target is opaque. */
export const OPAQUE_ALPHA: GPUBlendComponent = { srcFactor: 'zero', dstFactor: 'one' }
