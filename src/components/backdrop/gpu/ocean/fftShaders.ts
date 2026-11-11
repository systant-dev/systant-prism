// WGSL for the ocean's simulation: every wave's state at this moment, turned into
// the surface by inverse FFTs.
//
// Each sample of the surface is eight real values: three of displacement and
// five of how they change across the patch. Those are real-valued fields, so
// they go two to a complex number, four complex numbers packed in two vec4fs, and
// one FFT has to be run on all of them at once.
//
// The transform is a radix-2 decimation in time, in place, over a line of the
// patch held in workgroup memory. That is what makes it cheap: a line goes in and
// comes out in one dispatch, with a barrier between stages, rather than one
// dispatch per stage bouncing between textures. 128 invocations work a line of 256,
// one butterfly each, so a stage is 128 butterflies at once.
//
// There are two passes over each cascade, which is all there is to it:
//
// - The rows pass works out each wave's state straight into workgroup memory,
//   runs the rows through their FFT, and leaves them in a buffer.
// - The columns pass takes the columns from there, runs their FFT and writes the
//   results into textures, sharing a texture array between the cascades.
//
// A dispatch does every line of every cascade, so all the invocations of a frame
// are in a few dispatches. The stages are written out one by one rather than looped
// over, as a compiler may refuse a barrier in a loop.
//
// All but the last cascade hold their waves in a narrow band around the longest (see
// BAND), so that nearly all of a patch is empty. A row with no waves in it comes out of
// its FFT as nothing, so those rows are neither worked out nor kept, and a column starts
// from the nothing that workgroup memory starts as. That leaves a quarter of the rows of
// those cascades to do, a quarter of the memory, and a sixteenth of the spectrum.
import { BAND, BAND_SAMPLES, CASCADE_SAMPLES, CASCADES, SPECTRUM_STRIDE } from './spectrum'

/** How many bytes the FFT's uniforms take. */
export const FFT_PARAMS_SIZE = 16 + CASCADES * 16

/** How many rows of the cascades are kept between the two passes. */
export const KEPT_ROWS = (CASCADES - 1) * BAND_SAMPLES + CASCADE_SAMPLES

/** The first cascade that makes foam, and how many do: only those need the last frame's. */
export const FOAM_FIRST = 1
const FOAM_CASCADES = 2

/**
 * The cascade after those, of shorter waves, whose squeeze of the surface breaks the foam
 * up (surfaceShaders.ts): it makes no foam, so what it would keep as foam is that
 * squeeze, steadied over its last frames. And how many cascades the last frame is kept
 * of, for it as for the foam.
 */
export const LACE_CASCADE = FOAM_FIRST + FOAM_CASCADES
export const KEPT_CASCADES = FOAM_CASCADES + 1

const stages = Math.log2(CASCADE_SAMPLES)

const eachStage = Array.from(
  { length: stages },
  (_, stage) => `workgroupBarrier();\n  butterflies(index, ${stage}u);`,
).join('\n  ')

export const fftSource = /* wgsl */ `
const SAMPLES = ${CASCADE_SAMPLES}u;
const MASK = ${CASCADE_SAMPLES - 1}u;
const STAGES = ${stages}u;
const CASCADES = ${CASCADES}u;
const STRIDE = ${SPECTRUM_STRIDE};
const LAST = CASCADES - 1u;
const BAND = ${BAND}u;
const BAND_SAMPLES = ${BAND_SAMPLES}u;
const FOAM_FIRST = ${FOAM_FIRST}u;
const KEPT_CASCADES = ${KEPT_CASCADES}u;
const LACE_CASCADE = ${LACE_CASCADE}u;

struct Cascade {
  // 2π over the patch's side, then how the foam forms.
  step: f32,
  foamGain: f32,
  foamBias: f32,
  unused: f32,
}

struct Params {
  time: f32,
  // What is left of the foam after this frame.
  foamKept: f32,
  // How far the waves' tops are pulled in towards their crests.
  choppiness: f32,
  // What is left of the last frames' squeeze, which the foam is broken up by, after this one.
  laceKept: f32,
  cascades: array<Cascade, CASCADES>,
}

// Four complex numbers; see above.
struct Sample {
  a: vec4f,
  b: vec4f,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> twiddles: array<vec2f>;

var<workgroup> line: array<Sample, SAMPLES>;

// Two complex numbers times one.
fn rotate(v: vec4f, w: vec2f) -> vec4f {
  return vec4f(
    v.x * w.x - v.y * w.y,
    v.x * w.y + v.y * w.x,
    v.z * w.x - v.w * w.y,
    v.z * w.y + v.w * w.x
  );
}

// This invocation's butterfly of a stage: blocks of 2^(stage + 1), and
// 2^stage butterflies in each, so every sample is in exactly one.
fn butterflies(index: u32, stage: u32) {
  let half = 1u << stage;
  let offset = index & (half - 1u);
  let top = ((index >> stage) << (stage + 1u)) | offset;
  let bottom = top + half;
  let twiddle = twiddles[offset << (STAGES - 1u - stage)];
  let a = rotate(line[bottom].a, twiddle);
  let b = rotate(line[bottom].b, twiddle);
  line[bottom].a = line[top].a - a;
  line[bottom].b = line[top].b - b;
  line[top].a += a;
  line[top].b += b;
}

// Where an index is in a cascade's band, or BAND_SAMPLES and up outside it.
fn inBand(index: u32) -> u32 {
  return (index + BAND) & MASK;
}

// Whether a cascade holds anything along this row or column.
fn holds(index: u32, cascade: u32) -> bool {
  return cascade == LAST || inBand(index) < BAND_SAMPLES;
}

// Where a row of a cascade is, in a buffer of them.
fn rowOf(y: u32, cascade: u32) -> u32 {
  if (cascade == LAST) {
    return LAST * BAND_SAMPLES + y;
  }
  return cascade * BAND_SAMPLES + inBand(y);
}

fn reversed(index: u32) -> u32 {
  return reverseBits(index) >> (32u - STAGES);
}

fn frequency(index: u32) -> f32 {
  if (index <= SAMPLES / 2u) {
    return f32(index);
  }
  return f32(index) - f32(SAMPLES);
}

fn timesI(c: vec2f) -> vec2f {
  return vec2f(-c.y, c.x);
}

// A wave of a cascade, which has to be one it holds.
fn held(x: u32, y: u32, cascade: u32) -> vec4f {
  if (cascade == LAST) {
    return spectrum[LAST * BAND_SAMPLES * BAND_SAMPLES + y * SAMPLES + x];
  }
  return spectrum[(cascade * BAND_SAMPLES + inBand(y)) * BAND_SAMPLES + inBand(x)];
}

// What a wave comes to at this moment, as what it adds to each field. A pair
// holds two real fields as one complex one, the first in the real part.
fn wave(x: u32, y: u32, cascade: u32) -> Sample {
  let own = held(x, y, cascade);
  let opposite = held((SAMPLES - x) & MASK, (SAMPLES - y) & MASK, cascade);
  let phase = own.z * params.time;
  let e = vec2f(cos(phase), sin(phase));
  let g = vec2f(opposite.x, -opposite.y);
  // h0 e^(−iωt) + conj(h0(−k)) e^(iωt)
  let h = vec2f(own.x * e.x + own.y * e.y + g.x * e.x - g.y * e.y, own.y * e.x - own.x * e.y + g.x * e.y + g.y * e.x);

  let k = vec2f(frequency(x), frequency(y)) * params.cascades[cascade].step;
  let choppy = k * own.w * params.choppiness;
  let slope = timesI(h);
  // i k/|k| h along each axis, which draws the water in towards a crest. With the
  // opposite sign the same sum would broaden crests and sharpen troughs.
  let dx = slope * choppy.x;
  let dz = slope * choppy.y;
  // Those differentiated, by i k: −k k/|k| h.
  let dxx = -h * (choppy.x * k.x);
  let dzz = -h * (choppy.y * k.y);
  let dxz = -h * (choppy.x * k.y);

  return Sample(
    vec4f(dx + timesI(h), dz + timesI(dxz)),
    vec4f(slope * k.x + timesI(slope * k.y), dxx + timesI(dzz))
  );
}

@group(0) @binding(2) var<storage, read> spectrum: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> rows: array<Sample>;

fn doRow(index: u32, y: u32, cascade: u32) {
  for (var i = 0u; i < 2u; i++) {
    let x = index * 2u + i;
    if (holds(x, cascade)) {
      line[reversed(x)] = wave(x, y, cascade);
    }
  }
  ${eachStage}
  workgroupBarrier();
  let base = rowOf(y, cascade) * SAMPLES;
  for (var i = 0u; i < 2u; i++) {
    let x = index * 2u + i;
    rows[base + x] = line[x];
  }
}

// The rows of each band, of all but the last cascade.
@compute @workgroup_size(${CASCADE_SAMPLES / 2})
fn rowsMain(
  @builtin(local_invocation_index) index: u32,
  @builtin(workgroup_id) group: vec3u,
) {
  doRow(index, (group.x + SAMPLES - BAND) & MASK, group.z);
}

// Every row of the last cascade.
@compute @workgroup_size(${CASCADE_SAMPLES / 2})
fn lastRowsMain(
  @builtin(local_invocation_index) index: u32,
  @builtin(workgroup_id) group: vec3u,
) {
  doRow(index, group.x, LAST);
}

@group(1) @binding(0) var displacement: texture_storage_2d_array<rgba16float, write>;
@group(1) @binding(1) var slopes: texture_storage_2d_array<rgba16float, write>;
// What the last frame left of the foam, of those cascades that make any.
@group(1) @binding(2) var before: texture_2d_array<f32>;

// The surface is folding over itself where its Jacobian falls towards 0, which is
// where foam forms, and the last frame's fades out from there.
fn store(x: u32, y: u32, cascade: u32, s: Sample) {
  let dxx = s.b.z;
  let dzz = s.b.w;
  let dxz = s.a.w;
  let jacobian = (1.0 + dxx) * (1.0 + dzz) - dxz * dxz;
  let settings = params.cascades[cascade];
  let forming = saturate((settings.foamBias - jacobian) * settings.foamGain);
  var last = 0.0;
  if (cascade - FOAM_FIRST < KEPT_CASCADES) {
    last = textureLoad(before, vec2u(x, y), cascade - FOAM_FIRST, 0).w;
  }
  var foam = max(forming, last * params.foamKept);
  if (cascade == LACE_CASCADE) {
    // No foam of its own: how far its waves draw the surface together, averaged over the
    // last few frames. Its shortest waves pass in a few frames and average away, which
    // leaves the squeeze of the longer ones, several pixels across where the surface
    // reads it: taken as it is this frame, it is a speckle of single pixels.
    foam = mix(-0.5 * (dxx + dzz), last, params.laceKept);
  }
  textureStore(displacement, vec2u(x, y), cascade, vec4f(s.a.x, s.a.y, s.a.z, 1.0));
  textureStore(slopes, vec2u(x, y), cascade, vec4f(s.b.x, s.b.y, 0.5 * (dxx + dzz), foam));
}

@compute @workgroup_size(${CASCADE_SAMPLES / 2})
fn columnsMain(
  @builtin(local_invocation_index) index: u32,
  @builtin(workgroup_id) group: vec3u,
) {
  let x = group.x;
  let cascade = group.z;
  for (var i = 0u; i < 2u; i++) {
    let y = index * 2u + i;
    if (holds(y, cascade)) {
      line[reversed(y)] = rows[rowOf(y, cascade) * SAMPLES + x];
    }
  }
  ${eachStage}
  workgroupBarrier();
  for (var i = 0u; i < 2u; i++) {
    let y = index * 2u + i;
    store(x, y, cascade, line[y]);
  }
}
`

/**
 * The next mip of an array of textures, one dispatch to a level: a box filter,
 * which is right for slopes, as what a pixel sees of them is their average.
 */
export const mipSource = /* wgsl */ `
@group(0) @binding(0) var above: texture_2d_array<f32>;
@group(0) @binding(1) var below: texture_storage_2d_array<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn mipMain(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(below);
  if (id.x >= size.x || id.y >= size.y) {
    return;
  }
  let at = id.xy * 2u;
  let sum = textureLoad(above, at, id.z, 0)
    + textureLoad(above, at + vec2u(1u, 0u), id.z, 0)
    + textureLoad(above, at + vec2u(0u, 1u), id.z, 0)
    + textureLoad(above, at + vec2u(1u, 1u), id.z, 0);
  textureStore(below, id.xy, id.z, sum * 0.25);
}
`
