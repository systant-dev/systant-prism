// WGSL for the clouds over every scene: the noise they are shaped from, baked once,
// the pass that lights them into a small texture, and what the sky's own shader reads of
// that texture.
//
// They are heaped cloud: a slab of it, flat below and domed above, as high at each place
// as 3D noise says, whose third axis is time, so that the heaps slowly turn their shapes
// over as they drift. The eye looks up through the slab in a few steps, so that high in
// the view it sees the grey undersides of the heaps, and low down, where it looks across
// them, how they stand up out of the slab. The steps can only find the heaps' broad
// shapes: what breaks their outlines up, into lumps and wisps as fine as the texture can
// hold, is finer billows read once for each texel. How dark each part is goes by how much
// cloud the sun's or the moon's light has come through to reach it, found by looking at
// the heaps once more, a little way towards the light: so a heap is bright on the side
// the light comes from, and dark on the other.
//
// Each row of them is worked out every third frame, a third of the rows a frame, as they
// move only a small part of a pixel a frame, into a texture a third as high as a 1080p
// target, which is fine enough for cloud: only the rows above the horizon where the sky
// can show. The sky, the stars and the Milky Way read that texture back once a pixel, or
// once a star, and lie behind it, and the sky leaves out what thick cloud hides.
import { overSource, wgslFloat as f } from './sharedShaders'

/** How many texels the noise is across, each way, and how many mips it has, down to 1. */
export const NOISE_SIZE = 64
export const NOISE_MIPS = 7

/**
 * How far the horizon is lifted, as the sine of a height: what keeps the slab from
 * narrowing to a line along the horizon, as the curve of the Earth does.
 */
const LIFT = 0.1

/** How many tiles of noise to the height of the clouds' base, across: the size of the heaps. */
export const CLOUD_TILES = 0.5

/**
 * How many times larger than the heaps the regions are that they gather in and thin out
 * over, which keep the sky from looking the same all over.
 */
export const REGION_TILES = 0.22

/** How many times smaller than the regions the bends are that wander each heap's outline. */
export const WARP_TILES = 0.7

/**
 * The turns the noise and its regions are read through: each takes the noise's lattice
 * onto itself, scaled up by 5 and by 13, so that the tiles still meet seamlessly, but
 * their rows no longer line up with the wind's, which they would show along the horizon,
 * where many of them are in view.
 */
export const CLOUD_TURN = 5
export const REGION_TURN = 13

/**
 * Bakes the noise the clouds are shaped from, which tiles each way: Perlin noise
 * billowed by Worley noise in red, the shapes of heaped cloud, and Worley noise in the
 * rest, at four, eight and sixteen cells a tile, to eat into their edges.
 */
export const noiseBakeSource = /* wgsl */ `
@group(0) @binding(0) var noise: texture_storage_3d<rgba8unorm, write>;

const SIZE = ${NOISE_SIZE}u;

fn pcg3(seed: vec3u) -> vec3u {
  var v = seed * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> vec3u(16u);
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}

// 0–1 in each of three, for a lattice cell wrapped to a period, so the noise tiles.
fn random3(cell: vec3i, period: i32, salt: u32) -> vec3f {
  let wrapped = vec3u(((cell % period) + period) % period);
  return vec3f(pcg3(wrapped + vec3u(salt * 1013u, salt * 7919u, salt * 104729u))) / 4294967295.0;
}

fn gradientNoise(p: vec3f, period: i32, salt: u32) -> f32 {
  let cell = vec3i(floor(p));
  let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  var corners: array<f32, 8>;
  for (var i = 0; i < 8; i++) {
    let o = vec3i(i & 1, (i >> 1) & 1, (i >> 2) & 1);
    let g = normalize(random3(cell + o, period, salt) * 2.0 - 1.0 + 1e-4);
    corners[i] = dot(g, f - vec3f(o));
  }
  let x0 = mix(corners[0], corners[1], u.x);
  let x1 = mix(corners[2], corners[3], u.x);
  let x2 = mix(corners[4], corners[5], u.x);
  let x3 = mix(corners[6], corners[7], u.x);
  return mix(mix(x0, x1, u.y), mix(x2, x3, u.y), u.z);
}

// 1 at a cell's point, falling to 0 between them: billows.
fn billows(p: vec3f, period: i32, salt: u32) -> f32 {
  let cell = vec3i(floor(p));
  let f = fract(p);
  var nearest = 9.0;
  for (var i = 0; i < 27; i++) {
    let o = vec3i(i % 3 - 1, (i / 3) % 3 - 1, i / 9 - 1);
    let point = vec3f(o) + random3(cell + o, period, salt);
    let to = point - f;
    nearest = min(nearest, dot(to, to));
  }
  return 1.0 - saturate(sqrt(nearest));
}

@compute @workgroup_size(4, 4, 4)
fn bakeMain(@builtin(global_invocation_id) id: vec3u) {
  if (any(id >= vec3u(SIZE))) {
    return;
  }
  let p = (vec3f(id) + 0.5) / f32(SIZE);
  var perlin = 0.0;
  var amplitude = 1.0;
  var frequency = 4;
  for (var octave = 0; octave < 3; octave++) {
    perlin += gradientNoise(p * f32(frequency), frequency, 1u) * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  perlin = saturate(perlin / 1.75 + 0.5);
  let w4 = billows(p * 4.0, 4, 2u);
  let w8 = billows(p * 8.0, 8, 3u);
  let w16 = billows(p * 16.0, 16, 4u);
  let w32 = billows(p * 32.0, 32, 5u);
  let low = w4 * 0.625 + w8 * 0.25 + w16 * 0.125;
  textureStore(noise, id, vec4f(
    // Perlin noise for where cloud gathers, heaped up by billows of three sizes, which
    // make the lumps on the heaps.
    saturate(perlin * 0.62 + w4 * 0.26 + w8 * 0.14 + w16 * 0.07 - 0.06),
    low,
    w8 * 0.625 + w16 * 0.25 + w32 * 0.125,
    w16 * 0.75 + w32 * 0.25
  ));
}
`

/** One mip of the noise from the one above it, an eighth of its texels each. */
export const noiseMipSource = /* wgsl */ `
@group(0) @binding(0) var above: texture_3d<f32>;
@group(0) @binding(1) var below: texture_storage_3d<rgba8unorm, write>;

@compute @workgroup_size(4, 4, 4)
fn mipMain(@builtin(global_invocation_id) id: vec3u) {
  if (any(id >= textureDimensions(below))) {
    return;
  }
  var sum = vec4f(0.0);
  for (var i = 0; i < 8; i++) {
    sum += textureLoad(above, vec3i(id * 2u) + vec3i(i & 1, (i >> 1) & 1, (i >> 2) & 1), 0);
  }
  textureStore(below, id, sum * 0.125);
}
`

/**
 * The pass that lights the clouds, for a scene's module after its `Scene` struct, the
 * sky's light and the night sky's uniforms. Each texel of its target is a premultiplied
 * radiance, and how much of what lies behind the cloud hides, 0–1.
 */
export const cloudPassSource = /* wgsl */ `
@group(0) @binding(2) var noise: texture_3d<f32>;
@group(0) @binding(3) var tiling: sampler;

${overSource}

const NOISE_TEXELS = ${NOISE_SIZE}.0;
const NOISE_LODS = ${NOISE_MIPS - 1}.0;
const LIFT = ${f(LIFT)};
const CLOUD_TILES = ${f(CLOUD_TILES)};
const REGION_TILES = ${f(REGION_TILES)};
const WARP_TILES = ${f(WARP_TILES)};
const CLOUD_TURN = ${f(CLOUD_TURN)};
const REGION_TURN = ${f(REGION_TURN)};
// How much of the sky the clouds cover, 0–1.
const COVER = 0.54;
// How far on through the steps each lighting averaged at once starts from the last, as a share of a step.
const GOLDEN = 0.618034;
// How far cloud thickens from its edge, as noise, and how many mips blurrier than the
// texel the heaps' own shapes are read: the steps through the slab are too far apart to
// find anything finer.
const SOFT = 0.26;
const EDGE_BLUR = 2.1;
// How much more or less of the sky cloud covers from one region to the next, and from one
// smaller stretch to the next: where it covers more, heaps merge into large masses, and
// where less, only the hearts of the smallest show, as puffs. The heaps keep one size in
// the noise: were it larger in some places than others, the clouds would drift through
// those places faster or slower than the places themselves, and swell and shrink as they
// went.
const COVER_SWING = 0.36;
const PATCHY = 0.16;
// How much finer the billows are that break up the outlines of the heaps: a whole number
// of times finer, or their tiles wouldn't meet as the drift wraps round. How far they
// thicken and thin the noise the heaps are shaped from, which is what moves a heap's edge
// out into lumps and eats into it between them, and what they come to on the whole, so
// that they add as much cloud as they take away.
const DETAIL = 3.0;
const BILLOWING = 0.3;
const BILLOWS_MEAN = 0.52;
// How high in the slab, as a share of it, those billows are read: once for a texel, not at
// every step through the slab, so that they can be read as sharp as the texel is, with no
// steps to show between them. Low down, where the outlines of the heaps are, so that they
// drift with those.
const DETAIL_AT = 0.15;
// How far towards the light, in heights of the base, the heaps are looked at again, for
// how much cloud the light has come through: what shades the side of a heap away from it.
const LIGHT_REACH = 0.25;
// The longest way through cloud the light is taken to have come, as so many reaches.
const LIGHT_FAR = 4.0;
// How little of a texel's light a step through cloud may come to and not be looked at
// again towards the light: it is lit as the step before it was, or right through if it is
// the first, as a wisp is.
const FAINT = 0.05;
// How much of what lies behind it a trace of cloud hides, at the most.
const TRACE = 0.05;
// How deep the slab is, as a share of the height of its base, and how thick the noise
// has to be for a heap to reach its top. Fair-weather cloud is wider than it is tall, and
// the shallower the slab, the closer together the steps through it lie. How many steps the
// eye looks up through it in: about three to a heap it passes, within these bounds, which
// the blending of each lighting into the last few makes many more (clouds.ts).
const SLAB = 0.55;
const TOWER = 1.25;
// How high the tallest heaps reach, as a share of the slab, and how much higher than the
// slab's own base the bases of heaps lie, at the most, away from the hearts of billows.
const DOME = 1.0;
const BASE_RISE = 0.3;
// How far the regions push the heaps about, and the smaller bends their outlines, in
// heights of the base. How much flatter and taller than as set the heaps are from one
// stretch of sky to another.
const BENDING = 0.9;
const WANDER = 0.35;
const FLATTEST = 0.6;
const TALLEST = 1.35;
const STEPS_PER_TILE = 9.0;
const FEWEST_STEPS = 8;
const MOST_STEPS = 12;
// How thick cloud is to the eye, through a base's height of it.
const DENSITY = 30.0;
// How dark cloud is for the light having come through a base's height of it, and for
// lying that far above its base, once it is lit from below.
const SHADE = 3.0;
const SHADE_BELOW = 5.0;
// How fast cloud stops glowing with the light behind it as it thickens.
const THIN = 4.0;
// How much of the light that falls on cloud is scattered towards the eye, as of a white
// surface lit by it, and how much reaches the depths of a heap all the same.
const CLOUD_ALBEDO = 0.9;
const SPREAD_ON = 0.12;
// How much of the sky above lights cloud from below.
const SKY_ON_CLOUD = 1.0;
// How much of the moon's light, as exposed for the sky, cloud shows: a moonlit cloud is
// grey, and paler at its edges. Under rain cloud, which the moon is behind, less.
const MOON_ON_CLOUD = 0.8;
const MOON_ON_RAIN_CLOUD = 0.3;
// How much darker rain cloud is, and how much of its colour it keeps.
const RAIN_DARK = 0.1;
const RAIN_COLOUR = 0.3;
// How far the sky has clouded over for rain, 0–1, by the time this cloud is as dark as it goes.
const RAIN_AHEAD = 0.6;
// How much of the light falling on rain cloud it scatters towards the eye, the same every way.
const RAIN_PHASE = 0.5;
// How much of that even light cloud has out of the rain, by day and by night, and how
// dark it is then.
const EVEN_LIGHT = 0.8;
const EVEN_LIGHT_NIGHT = 0.2;
const CLEAR_DARK = 0.65;
// How much of the sun's and moon's colour cloud keeps at the top of the view, and the heights,
// as sines, between which it goes from all of it to that.
const HIGH_TINT = 0.25;
const TINT_LOW = 0.02;
const TINT_HIGH = 0.24;
// How fast distance takes cloud into the haze over the horizon.
const HAZE = 0.045;
// How high over the horizon, as a sine, cloud is gone into it: there the eye looks along
// the slab, through so many heaps that they would only smear into a band.
const HORIZON_FADE = 0.08;

// The light of a cloud, premultiplied, then how much of what lies behind it it hides, 0–1.
struct Cloud {
  light: vec3f,
  cover: f32,
}


// How far rain has darkened the clouds, 0–1: ahead of the sky clouding over behind
// them, so that they are never the paler of the two.
fn rainAhead() -> f32 {
  return smoothstep(0.0, RAIN_AHEAD, scene.wind.w);
}

// How cloud scatters light, against how a white surface would: brightest looking towards
// the light through it, which silvers the edges round the sun and the moon. byDay is
// how much of the light is the sun's, 0–1.
fn cloudPhase(cosine: f32, byDay: f32) -> f32 {
  let forward = 4.0 * PI * mix(henyeyGreenstein(cosine, 0.72), henyeyGreenstein(cosine, -0.15), 0.55);
  // Under rain cloud the light comes through the deck above, from no way in particular.
  // Out of the rain by day, much the same, with only a little of the glow towards the
  // sun: these views look towards it, and all of it would wash the heaps out to white.
  // The moon's light washes nothing out, and with as little of its glow a cloud beside
  // it is a black shape with no edge: by night most of the glow is kept.
  return mix(forward, RAIN_PHASE, max(rainAhead(), mix(EVEN_LIGHT_NIGHT, EVEN_LIGHT, byDay)));
}

// Where the way d meets the base of the slab, in heights of the base across it.
fn onBase(d: vec3f) -> vec2f {
  return d.xz / (max(d.y, 0.0) + LIFT);
}

// The mip a read of the noise this many tiles a pixel apart wants.
fn lodOf(tilesPerPixel: f32) -> f32 {
  return clamp(log2(max(tilesPerPixel * NOISE_TEXELS, 1e-6)), 0.0, NOISE_LODS);
}

// How far up the slab a heap reaches where the noise is this thick, as a share of the
// slab: rising gently from its edge to a rounded crown.
fn heapTop(thick: f32, cover: f32, dome: f32) -> f32 {
  let rise = saturate((thick - (1.0 - cover)) / (SOFT * TOWER * dome * 0.8));
  return smoothstep(0.0, 1.0, rise) * dome;
}

// A place on the slab as a place in its noise, the turned way round.
fn noiseAt(at: vec2f) -> vec2f {
  let p = at * (CLOUD_TILES / CLOUD_TURN) + vec2f(heavens.clouds.x, 0.0);
  return vec2f(3.0 * p.x + 4.0 * p.y, 3.0 * p.y - 4.0 * p.x);
}

// How much of the sky cloud covers in the region about a place.
// With it, how far the heaps there are pushed about, in heights of the base: what bends
// their outlines out of the noise's own, into shapes of their own.
// And how tall its heaps are: some stretches of sky have them flat and spread out, some
// towering.
struct Region {
  cover: f32,
  bent: vec2f,
  tower: f32,
}

// A place on the slab, as a place in noise this many times larger than the heaps, turned
// a third way round, drifting with them.
fn turnedAt(at: vec2f, tiles: f32, drift: f32) -> vec2f {
  let p = at * (CLOUD_TILES * tiles / REGION_TURN) + vec2f(drift, 0.0);
  return vec2f(5.0 * p.x + 12.0 * p.y, 5.0 * p.y - 12.0 * p.x);
}

fn regionAt(at: vec2f, lod: f32) -> Region {
  let n = textureSampleLevel(noise, tiling, vec3f(turnedAt(at, REGION_TILES, heavens.clouds.y), heavens.clouds.w + 0.5), max(lod + log2(REGION_TILES), 0.0) + 1.0);
  // Smaller bends, which wander the outline of each heap as the region's bend the field.
  let w = textureSampleLevel(noise, tiling, vec3f(turnedAt(at, WARP_TILES, heavens.clouds.z), heavens.clouds.w + 0.25), max(lod + log2(WARP_TILES), 0.0) + 1.0);
  return Region(
    COVER + (n.r - 0.5) * 2.0 * COVER_SWING + (w.r - 0.5) * 2.0 * PATCHY,
    (n.gb - 0.5) * BENDING + (w.gb - 0.5) * WANDER,
    mix(FLATTEST, TALLEST, smoothstep(0.3, 0.7, n.a))
  );
}

// The slab, looked up through from its base: each step a height in it, and the heap there
// as high as the noise is thick, so that where the eye passes under a heap it sees its
// base, and where it passes beside one, its side, darker the more cloud lies between it
// and the light. Where in its steps it starts goes by the texel and by how far on this
// lighting is, as a share of a step. Its light comes premultiplied.
fn cloudThrough(d: vec3f, footprint: f32, lightWay: vec3f, lamp: vec3f, byDay: f32, around: vec3f, pixel: vec2f, lighting: f32) -> Cloud {
  let base = onBase(d);
  let lod = lodOf(footprint * CLOUD_TILES);
  let region = regionAt(base, lod);
  let cover = region.cover;
  if (cover <= 0.0) {
    return Cloud(vec3f(0.0), 0.0);
  }
  // Towards the light, only thin cloud glows with it: thick cloud lets little through, and
  // shows only what it scatters every way.
  let forward = cloudPhase(dot(d, lightWay), byDay);
  // Once the sun has set beneath the clouds, they are lit from below.
  let fromBelow = 1.0 - smoothstep(-0.06, 0.12, lightWay.y);
  // Each texel starts its steps somewhere of its own, or texels in a row would all start
  // alike and the steps would show as lines along it: spread so that any few texels side
  // by side start all through a step between them, which the sky, reading them smoothly,
  // sees as that many times the steps. Each lighting starts them somewhere else again, so
  // that blended into the last ones, they see more of the steps still.
  let start = fract(interleaved(pixel) + lighting);
  // As many steps as the way through the slab crosses heaps, about: few high in the view,
  // where it goes up through the slab, and more low down, where it goes along it.
  let across = length(base) * SLAB;
  let steps = clamp(i32(ceil(across * CLOUD_TILES * STEPS_PER_TILE)), FEWEST_STEPS, MOST_STEPS);
  let stepLength = across / f32(steps);
  let share = 1.0 / f32(steps);
  // The noise is read no sharper than the steps are apart, or they would show as bands.
  let blur = max(lod + EDGE_BLUR, lodOf(stepLength * CLOUD_TILES) - 1.0);
  // The billows that break up the heaps' outlines, for the texel, as sharp as it is: how
  // much thinner they make the noise here, or thicker.
  let detailed = base * (1.0 + DETAIL_AT * SLAB) + region.bent;
  let fine = textureSampleLevel(noise, tiling, vec3f(noiseAt(detailed) * DETAIL, heavens.clouds.w * 2.0), lodOf(footprint * CLOUD_TILES * DETAIL));
  let eaten = (BILLOWS_MEAN - dot(fine.gba, vec3f(0.5, 0.3, 0.2))) * BILLOWING;
  // How far towards the light the heaps are looked at again, across the slab, and how far
  // up it the light climbs in that, as a share of it.
  let reach = lightWay.xz * LIGHT_REACH;
  let climb = lightWay.y * LIGHT_REACH / SLAB;
  let dome = DOME * region.tower;
  var light = vec3f(0.0);
  var through = 1.0;
  // The last height looked at, how far under its heap's top it was, and how far over its
  // base. And how far the light had come through cloud to the last step lit.
  var hLast = 0.0;
  var underLast = 0.0;
  var overLast = 0.0;
  var come = 0.0;
  // The heights looked at are the slab's base, its top, and a step apart between them.
  for (var i = 0; i <= steps + 1; i++) {
    let h = saturate((f32(i) - 1.0 + start) * share);
    let span = h - hLast;
    let at = base * (1.0 + h * SLAB) + region.bent;
    let n = textureSampleLevel(noise, tiling, vec3f(noiseAt(at), heavens.clouds.w), blur);
    // How far up the slab the heap here reaches. And how high its base is: lowest at the
    // heart of each billow and rising away from it, so its underside is rounded and uneven
    // too, but never above halfway up the heap.
    let top = heapTop(n.r - eaten, cover, dome);
    let lift = min((1.0 - n.g) * BASE_RISE, top * 0.5);
    let under0 = underLast;
    let over0 = overLast;
    let under1 = top - h;
    let over1 = h - lift;
    underLast = under1;
    overLast = over1;
    let h0 = hLast;
    hLast = h;
    if (i == 0 || max(under0, under1) <= 0.0 || max(over0, over1) <= 0.0) {
      continue;
    }
    // The part of the step from the last height to this that lies in the heap, with the
    // heap's top and base taken to run straight between the two: so they move smoothly
    // through the steps, and where the steps lie never shows.
    var enters = 0.0;
    var leaves = 1.0;
    if (under0 < 0.0) {
      enters = under0 / (under0 - under1);
    } else if (under1 < 0.0) {
      leaves = under0 / (under0 - under1);
    }
    if (over0 < 0.0) {
      enters = max(enters, over0 / (over0 - over1));
    } else if (over1 < 0.0) {
      leaves = min(leaves, over0 / (over0 - over1));
    }
    if (leaves <= enters) {
      continue;
    }
    let part = (enters + leaves) * 0.5;
    let middle = h0 + part * span;
    let inside = mix(under0, under1, part);
    let above = mix(over0, over1, part);
    let seen = 1.0 - exp(-inside * (leaves - enters) * DENSITY * span * across);
    // How far the light has come through cloud to here: a reach towards it, how far under
    // the heap's top it still is, against how far under it is here. Read only where there
    // is cloud that shows, so clear sky costs nothing more.
    if (seen * through > FAINT) {
      let towards = textureSampleLevel(noise, tiling, vec3f(noiseAt(base * (1.0 + middle * SLAB) + region.bent + reach), heavens.clouds.w), blur).r;
      let ahead = heapTop(towards - eaten, cover, dome) - middle - climb;
      come = LIGHT_REACH * inside / max(inside - ahead, inside / LIGHT_FAR);
    }
    let depth = mix(come * SHADE, above * SHADE_BELOW, fromBelow);
    let lit = exp(-depth) + SPREAD_ON;
    let phased = lamp * mix(min(forward, 1.0), forward, exp(-inside * THIN));
    let sky = around * (0.3 + 0.6 * middle) * exp(-inside);
    light += (phased * lit + sky) * CLOUD_ALBEDO * seen * through;
    through *= 1.0 - seen;
    if (through < 0.02) {
      break;
    }
  }
  return Cloud(light, 1.0 - through);
}

// Light as rain leaves it on cloud: the same shapes, only greyer and darker.
// Out of the rain they are a little darker than lit, too, so that their light and shade
// stay in soft greys and off-white that show their shapes, rather than going to white.
fn rained(light: vec3f) -> vec3f {
  let rain = rainAhead();
  let grey = vec3f(dot(light, vec3f(0.3, 0.5, 0.2)));
  return mix(light, mix(grey, light, RAIN_COLOUR), rain) * mix(CLEAR_DARK, RAIN_DARK, rain);
}

// The clouds as lit this time: their premultiplied light, and how much they hide, drawn
// over the last few lightings (clouds.ts). What one lighting misses, between its steps,
// the next few see, so small shapes at the edges hold steady rather than coming and
// going. They move so little between one lighting and the next that nothing trails
// behind them. A frame held still has none before it, so it averages several of its own.
@fragment
fn cloudFragment(over: Over) -> @location(0) vec4f {
  let ndc = ndcOf(over.uv);
  let d = skyWay(ndc);
  // How far apart neighbouring texels are on the slab's base, before anything branches.
  let base = onBase(d);
  let footprint = max(length(dpdx(base)), length(dpdy(base)));
  if (d.y <= 0.0) {
    return vec4f(0.0);
  }
  // The light above the cloud: the sun's and moon's before the rain cloud takes it, as
  // rain changes only how dark this cloud is.
  let cover = cloudCover();
  let sun = scene.sunlit.rgb / cover;
  let moon = scene.moonlit.rgb / cover * mix(MOON_ON_CLOUD, MOON_ON_RAIN_CLOUD, rainAhead());
  let sunShare = dot(sun, vec3f(1.0)) / max(dot(sun + moon, vec3f(1.0)), 1e-6);
  let lightWay = normalize(mix(heavens.moon.xyz, heavens.sun.xyz, sunShare) + vec3f(0.0, 1e-4, 0.0));
  // The colour the sun and moon tint the clouds with, strongest low down, near the horizon,
  // and fading towards their own brightness higher up, so that the sky seems to stand in
  // depth over the scene at dawn and dusk.
  let lit = (sun + moon) / PI;
  let lamp = mix(vec3f(dot(lit, vec3f(0.3, 0.5, 0.2))), lit, mix(1.0, HIGH_TINT, smoothstep(TINT_LOW, TINT_HIGH, d.y)));
  let lightings = u32(heavens.cloudSteps.y);
  var light = vec3f(0.0);
  var hidden = 0.0;
  for (var i = 0u; i < lightings; i++) {
    let cloud = cloudThrough(d, footprint, lightWay, lamp, sunShare, scene.overhead.rgb * SKY_ON_CLOUD, over.position.xy, heavens.cloudSteps.x + f32(i) * GOLDEN);
    light += cloud.light;
    hidden += cloud.cover;
  }
  // The faintest traces of cloud, which lie over as much of the sky again as the cloud
  // that shows, are left out: the sky reads them all the same, and none of them is seen.
  let traced = hidden / f32(lightings);
  hidden = (traced - TRACE) / (1.0 - TRACE);
  if (hidden <= 0.0) {
    return vec4f(0.0);
  }
  light = rained(light) / f32(lightings) * (hidden / traced);
  // Far cloud fades into the sky as it is behind it, in the scene's own lens, and into
  // nothing on the horizon itself.
  let seen = sceneWayAt(ndc);
  let clear = exp(-HAZE / (d.y + LIFT));
  let fade = smoothstep(0.0, HORIZON_FADE, d.y);
  return vec4f(skyRadiance(seen) * hidden * (1.0 - clear) + light * clear, hidden) * fade;
}
`

/**
 * What the sky's own shader reads of the clouds, after heavensSource: the texture they
 * were lit into this frame, at bindings 4 and 5, and how much of the sun's and moon's
 * discs lie behind them.
 */
export const cloudCoverSource = /* wgsl */ `
@group(0) @binding(4) var clouds: texture_2d<f32>;
@group(0) @binding(5) var clamped: sampler;

// The mip of the clouds' texture the sky reads: the one they are lit into.
const CLOUD_LEVEL = 0;

// The clouds at this place on their texture, 0–1 from its top left, read smoothly: a
// cubic B-spline over the texels about it, in four reads that each blend four. Read
// straight, as the texels are many pixels wide, their blending would draw straight lines
// across and down the cloud, along the rows and columns of the texels.
fn cloudsSmoothly(uv: vec2f) -> vec4f {
  // A mip further down covers all the texels the spline reads, and is empty where they are:
  // most of the sky, which is then read once.
  if (textureSampleLevel(clouds, clamped, uv, f32(CLOUD_LEVEL + 1)).a <= 0.0) {
    return vec4f(0.0);
  }
  let size = vec2f(textureDimensions(clouds, CLOUD_LEVEL));
  let p = uv * size - 0.5;
  let cell = floor(p);
  let f = p - cell;
  let f2 = f * f;
  let f3 = f2 * f;
  let w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  let w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  let w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  let w3 = f3 / 6.0;
  let g0 = w0 + w1;
  let g1 = w2 + w3;
  let near = (cell - 0.5 + w1 / g0) / size;
  let far = (cell + 1.5 + w3 / g1) / size;
  let level = f32(CLOUD_LEVEL);
  return g0.y * (g0.x * textureSampleLevel(clouds, clamped, near, level) + g1.x * textureSampleLevel(clouds, clamped, vec2f(far.x, near.y), level))
    + g1.y * (g0.x * textureSampleLevel(clouds, clamped, vec2f(near.x, far.y), level) + g1.x * textureSampleLevel(clouds, clamped, far, level));
}

// The cloud at this place on the screen, in clip space: premultiplied light, and how much
// it hides. Read once, for a star or a disc, where its texels' lines can't show.
fn cloudAt(ndc: vec2f) -> vec4f {
  return textureSampleLevel(clouds, clamped, uvOf(ndc), f32(CLOUD_LEVEL));
}

// How much of what lies behind the cloud shows through it, here on the screen.
fn cloudClearAt(ndc: vec2f) -> f32 {
  return 1.0 - cloudAt(ndc).a;
}

// How much of a disc of this radius, in radians, in the way w, lies behind cloud, 0–1:
// read across it, as the scene's own lens puts it on the screen.
fn discClouded(w: vec3f, radius: vec2f) -> f32 {
  let depth = dot(w, scene.forward.xyz);
  if (depth <= 0.05) {
    return 0.0;
  }
  let centre = sceneOnScreen(w, depth);
  let reach = radius * vec2f(scene.right.w, scene.up.w) / depth * 0.7;
  return (cloudAt(centre).a * 2.0
    + cloudAt(centre + vec2f(reach.x, 0.0)).a
    + cloudAt(centre - vec2f(reach.x, 0.0)).a
    + cloudAt(centre + vec2f(0.0, reach.y)).a
    + cloudAt(centre - vec2f(0.0, reach.y)).a) / 6.0;
}
`
