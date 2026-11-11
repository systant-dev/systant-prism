/**
 * A smooth, roughly Gaussian falloff for a radial gradient, as [opacity,
 * distance from the centre in %]. Enough stops that the curve has no visible
 * kinks where the gradient interpolates linearly.
 */
export const FALLOFF = [
  [1, 0],
  [0.85, 10],
  [0.6, 22],
  [0.36, 35],
  [0.18, 50],
  [0.07, 66],
  [0.02, 82],
  [0, 100],
] as const
