// WGSL shared by the sky and the ocean: the uniforms they both read, and the light of
// the sky, from gpu/sky.
import { SKY_UNIFORM, skyFieldsSource, skyLightSource, SKY_UNIFORMS_SIZE } from '../sky'
import { CASCADES, SLOPE_ENTRIES } from './spectrum'

/** How many bytes the scene's uniforms take. */
export const SCENE_UNIFORMS_SIZE = SKY_UNIFORMS_SIZE + 16 * (CASCADES + SLOPE_ENTRIES + 1)

const FIRST_FIELD = SKY_UNIFORMS_SIZE / 4

/** Where each field of the scene's uniforms starts, in 32-bit floats. */
export const SCENE_UNIFORM = {
  ...SKY_UNIFORM,
  cascades: FIRST_FIELD,
  unresolved: FIRST_FIELD + CASCADES * 4,
  pixels: FIRST_FIELD + (CASCADES + SLOPE_ENTRIES) * 4,
} as const

export const sceneSource = /* wgsl */ `
const CASCADES = ${CASCADES}u;
const SLOPE_ENTRIES = ${SLOPE_ENTRIES};

struct Cascade {
  size: f32,
  perSize: f32,
  // Where its waves become too short for the mesh, as a vertex spacing.
  shortest: f32,
  unused: f32,
}

struct Scene {
${skyFieldsSource}
  cascades: array<Cascade, CASCADES>,
  // The slope variance left to the waves shorter than each octave (spectrum.ts).
  unresolved: array<vec4f, SLOPE_ENTRIES>,
  // How many pixels high the target is, in x.
  pixels: vec4f,
}

@group(0) @binding(0) var<uniform> scene: Scene;

${skyLightSource}

// How much of the light that meets the water head on it reflects.
const REFLECTANCE = 0.02;

// The slope variance of waves too short for a pixel this wide, in metres.
fn unresolved(footprint: f32) -> vec2f {
  // 2 mm waves are the first entry, and a pixel shows waves down to twice its width.
  let at = clamp(log2(max(footprint, 1e-4) * 2.0 / 0.002), 0.0, f32(SLOPE_ENTRIES) - 1.001);
  let low = u32(at);
  return mix(scene.unresolved[low].xy, scene.unresolved[low + 1u].xy, at - f32(low));
}
`
