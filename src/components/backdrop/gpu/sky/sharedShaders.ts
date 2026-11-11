// WGSL that every scene needs a copy of, each for itself.

/** A number as WGSL: a float, even when it is whole. */
export const wgslFloat = (value: number) => (Number.isInteger(value) ? `${value}.0` : `${value}`)

/** One triangle over the whole target, at the far depth, with where each pixel is from its top left, 0–1. */
export const overSource = /* wgsl */ `
struct Over {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

// A corner of the triangle, for a vertex shader that passes on more.
fn overCorner(index: u32) -> Over {
  let uv = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
  return Over(vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0), uv);
}

@vertex
fn overVertex(@builtin(vertex_index) index: u32) -> Over {
  return overCorner(index);
}
`

/** One mip from the one above it, drawn over the whole of the mip with overVertex. */
export const mipSource = /* wgsl */ `
@group(0) @binding(0) var above: texture_2d<f32>;

${overSource}

@fragment
fn mipFragment(over: Over) -> @location(0) vec4f {
  let at = vec2i(over.position.xy) * 2;
  return (textureLoad(above, at, 0)
    + textureLoad(above, at + vec2i(1, 0), 0)
    + textureLoad(above, at + vec2i(0, 1), 0)
    + textureLoad(above, at + vec2i(1, 1), 0)) * 0.25;
}
`

/** A hash, for what is worked out from a number alone: PCG's, and 0–1 from a seed. */
export const hashSource = /* wgsl */ `
fn permuted(state: u32) -> u32 {
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn mixed(seed: u32) -> u32 {
  return permuted(seed * 747796405u + 2891336453u);
}

fn scattered(seed: u32) -> f32 {
  return f32(mixed(seed)) / 4294967295.0;
}
`

/** Interleaved gradient noise, 0–1: a value for each pixel that shows no pattern. */
export const interleavedSource = /* wgsl */ `
fn interleaved(pixel: vec2f) -> f32 {
  return fract(52.9829189 * fract(dot(pixel, vec2f(0.06711056, 0.00583715))));
}
`

/**
 * How far above the horizon the sun and moon sink into the haze that lies along it, in
 * radians, set for each pipeline: 0 where a scene hides its horizon. Over the ocean, a
 * disc meeting the water would otherwise be cut off along it as if by a knife, and the
 * stars fade into the same haze.
 */
export const horizonVeilSource = /* wgsl */ `
override HORIZON_VEIL: f32 = 0.0;
// HORIZON_VEIL kept above 0 for smoothstep, which won't compile with both its edges at
// 0, even in a branch that never runs: the override is folded in as a constant first.
override VEIL_EDGE: f32 = max(HORIZON_VEIL, 1e-6);
`
