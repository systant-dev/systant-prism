// WGSL for what rain does to the ocean: the rings each drop sets off, and the splash it
// throws up.
//
// A drop is worked out from where it falls and the clock, so nothing is kept from
// frame to frame, and the rings and the splash of a drop agree without being told.
// The water is divided into cells, a tile of them repeating across the ocean, and each
// cell takes a drop every second or so, somewhere new each time.
//
// Every texel of the rings looks at the drops of the cells around it, which comes to a few
// million looks a frame at a few thousand drops, so each is worked out once a frame, and kept.
//
// Rings are written to a texture every frame, which the ocean then reads like one more
// cascade of waves, by the water's rest position, so they ride the swell. Being mipped,
// they fade away as they become too small for a pixel, and the surface shader carries
// on what they did as roughness. That is why the ocean goes matte in the rain and loses
// its glitter: there are rings all the way to the horizon, though they can't be seen.
// Each ring is a short train of waves spreading from the drop, as a real one is. Those
// are where an ocean in the rain gets its stippled look from close up.
//
// Only some of a tile's drops, over only some of the tiles, also throw up a splash:
// what's on the water is drawn as a sprite that stands on it, moved by the waves as
// the water under it is, and hidden by any wave in front. It is what a slow camera
// makes of the real thing: a crown of water thrown up around the drop's crater, which
// tears into droplets, then the jet that rises from the middle as the crater closes,
// and the droplets falling back. Most are small and a few are large, as drops are:
// a rain of splashes all alike is what gives away a fake one.

import { hashSource } from '../sky'

/** How many samples a side the rings have, and how many a shader handles at once. */
export const RIPPLE_SAMPLES = 512
export const RIPPLE_GROUP = 8

/** How many mips the rings have, down to 2×2. */
export const RIPPLE_MIPS = Math.log2(RIPPLE_SAMPLES)

/** How many metres of water a repeat of the rings covers. */
export const RIPPLE_TILE = 20

/** How many cells a side the tile has. A ring can't reach past the cells beside its own. */
const CELLS = 32

/** How many cell grids are laid over each other, each with a drop of its own per cell. */
const GRIDS = 2

/** How many drops there are at once, how many a shader handles at once, and how many bytes each takes. */
export const LANDED_DROPS = CELLS * CELLS * GRIDS
export const LANDED_GROUP = 64
export const LANDED_SIZE = 24

/** How many splashes there can be at once, in full rain. */
const SPLASHES = 16384

/** Vertices to a splash's quad. */
export const SPLASH_QUADS = 4

/** How many splashes to draw, for rain `amount` hard. */
export function splashCount(amount: number) {
  return Math.ceil(SPLASHES * amount)
}

/** Where drops land and when, for the rings and the splashes alike. */
export const dropSource = /* wgsl */ `
const TILE = ${RIPPLE_TILE}.0;
const CELLS = ${CELLS};
const CELL = TILE / f32(CELLS);
const GRIDS = ${GRIDS}u;
// How long a cell goes between drops, in seconds.
const DROP_EVERY = 1.1;

${hashSource}

struct Drop {
  // Where it landed, in its cell, 0–1, then in metres along the tile, and how long ago, in seconds.
  spot: vec2f,
  at: vec2f,
  age: f32,
  // 0–1, most of them small, and whether it has fallen yet, as rain sets in.
  size: f32,
  falls: bool,
  // Different with each drop that lands in the cell.
  seed: u32,
}

fn dropIn(cell: vec2i, grid: u32) -> Drop {
  let wrapped = (cell + vec2i(CELLS)) % vec2i(CELLS);
  let own = mixed(u32(wrapped.x + wrapped.y * CELLS) + grid * u32(CELLS * CELLS) + 1u);
  let every = DROP_EVERY * (0.75 + 0.5 * scattered(own));
  let cycles = scene.eyeTime.w / every + scattered(own + 1u);
  let cycle = floor(cycles);
  let seed = mixed(own ^ (u32(cycle) * 2654435761u));
  let spot = vec2f(scattered(seed), scattered(seed + 1u));
  let size = pow(scattered(seed + 2u), 3.0);
  let falls = scattered(own + 2u) < scene.wind.w;
  return Drop(spot, (vec2f(cell) + spot) * CELL, (cycles - cycle) * every, size, falls, seed);
}

// A drop as it is kept, for all the texels of the rings to find it by its cell.
struct Landed {
  spot: vec2f,
  age: f32,
  size: f32,
  falls: u32,
  seed: u32,
}
`

/** Works out every drop, once a frame, before the rings look at them. */
export const landedSource = /* wgsl */ `
@group(0) @binding(1) var<storage, read_write> landed: array<Landed>;

@compute @workgroup_size(${LANDED_GROUP})
fn landedMain(@builtin(global_invocation_id) id: vec3u) {
  let cells = u32(CELLS);
  let cell = vec2i(i32(id.x % cells), i32((id.x / cells) % cells));
  let drop = dropIn(cell, id.x / (cells * cells));
  landed[id.x] = Landed(drop.spot, drop.age, drop.size, u32(drop.falls), drop.seed);
}
`

export const rippleSource = /* wgsl */ `
// How fast rings spread, in metres a second, how long they last, in seconds, and how
// many metres their waves are from crest to crest, at the start and by the end.
const SPREAD = 0.42;
const RING_LIFE = 0.42;
const WAVELENGTH = 0.14;
const LONGEST = 0.26;
// How steep the waves of a ring start out, and how many of them there are.
const STEEPEST = 0.5;
const TRAIN = 1.35;
// How wide the white of the drop's landing is, in metres, and how fast it goes.
const LANDING = 0.045;
const LANDING_LIFE = 0.09;

@group(0) @binding(1) var ripples: texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(2) var<storage, read> landed: array<Landed>;

// A cell's drop, which may be on the tile that lies next to this one.
fn landedIn(cell: vec2i, grid: u32) -> Drop {
  let wrapped = (cell + vec2i(CELLS)) % vec2i(CELLS);
  let drop = landed[u32(wrapped.x + wrapped.y * CELLS) + grid * u32(CELLS * CELLS)];
  return Drop(drop.spot, (vec2f(cell) + drop.spot) * CELL, drop.age, drop.size, drop.falls != 0u, drop.seed);
}

// A drop's rings: the slope they give the water here, then how white they leave it.
fn ringsAt(here: vec2f, drop: Drop) -> vec4f {
  let to = here - drop.at;
  let away = length(to);
  let age = drop.age;
  let big = 0.55 + drop.size * 1.3;
  let wavelength = mix(WAVELENGTH, LONGEST, saturate(age * 1.2));
  let behind = (away - SPREAD * age) / (wavelength * TRAIN);
  let train = exp(-behind * behind);
  let fades = exp(-age / RING_LIFE) * smoothstep(0.0, 0.05, age);
  let wave = sin(behind * TRAIN * 2.0 * PI) * train * fades * STEEPEST * big;
  let out = to / max(away, 1e-3);
  let white = exp(-away * away / (LANDING * LANDING * big)) * exp(-age / LANDING_LIFE);
  return vec4f(out * wave, 0.0, white);
}

@compute @workgroup_size(${RIPPLE_GROUP}, ${RIPPLE_GROUP})
fn rippleMain(@builtin(global_invocation_id) id: vec3u) {
  let here = (vec2f(id.xy) + 0.5) * TILE / ${RIPPLE_SAMPLES}.0;
  let cell = vec2i(floor(here / CELL));
  var total = vec4f(0.0);
  for (var grid = 0u; grid < GRIDS; grid++) {
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let drop = landedIn(cell + vec2i(x, y), grid);
        if (drop.falls) {
          total += ringsAt(here, drop);
        }
      }
    }
  }
  textureStore(ripples, id.xy, 0, total);
}
`

export const splashSource = /* wgsl */ `
// How long a splash lasts, in seconds, slowed a little: a real one is over in a frame
// or two, and the eye only gets a flicker of white.
const SPLASH_LIFE = 0.3;
// How wide one is, in metres, for the smallest drop and the largest.
const SMALLEST = 0.04;
const LARGEST = 0.13;
// How near and far they land, in metres from the eye. Further off they are too small
// to see and the ocean's own roughness takes over.
const NEAREST_SPLASH = 13.0;
const FURTHEST_SPLASH = 130.0;
// The fewest pixels wide a splash is drawn, fainter for being less than that.
const FEWEST_PIXELS = 1.4;
// How far the quad reaches around the drop, as widths: to the sides, down and up.
const QUAD_SIDE = 1.9;
const QUAD_DOWN = 0.7;
const QUAD_UP = 3.0;
// How many pixels wide one has to be to show what it is made of.
const DETAILED = 6.0;
// How many droplets each throws.
const DROPLETS = 6;
// How bright the water it throws up is, for all the light that falls on it.
const SPRAY = 0.26;

@group(0) @binding(1) var displacement: texture_2d_array<f32>;
@group(0) @binding(2) var waves: sampler;

struct Splash {
  @builtin(position) position: vec4f,
  // Where this is on it, in widths from where the drop landed.
  @location(0) at: vec2f,
  // How far through its life it is, 0–1, and something of its own, 0–1.
  @location(1) life: f32,
  @location(2) own: f32,
  // How wide a pixel is in widths, how strong it is, and its light.
  @location(3) pixel: f32,
  @location(4) strength: f32,
  @location(5) radiance: vec3f,
}

fn gone() -> Splash {
  return Splash(vec4f(0.0, 0.0, 0.0, 1.0), vec2f(0.0), 0.0, 0.0, 0.0, 0.0, vec3f(0.0));
}

@vertex
fn splashVertex(@builtin(vertex_index) corner: u32, @builtin(instance_index) index: u32) -> Splash {
  let cells = u32(CELLS);
  let cell = vec2i(i32(index % cells), i32((index / cells) % cells));
  let drop = dropIn(cell, (index / (cells * cells)) % GRIDS);
  let lasts = SPLASH_LIFE * (0.7 + 0.6 * drop.size);
  if (!drop.falls || drop.age >= lasts) {
    return gone();
  }

  // The drop lands on every tile of the ocean. This splash is at the one of those
  // nearest a spot of its own, for this drop, chosen to fall evenly down the view.
  let chosen = mixed(drop.seed ^ (index * 2654435761u));
  let far = pow(FURTHEST_SPLASH / NEAREST_SPLASH, scattered(chosen)) * NEAREST_SPLASH;
  let halfWide = 1.0 / scene.right.w;
  let across = (scattered(chosen + 1u) * 2.0 - 1.0) * halfWide * far * 1.15;
  let wanted = scene.eyeTime.xz + vec2f(across, far);
  let rest = drop.at + round((wanted - drop.at) / TILE) * TILE;

  var moved = vec3f(0.0);
  for (var i = 0u; i < CASCADES; i++) {
    moved += textureSampleLevel(displacement, waves, rest * scene.cascades[i].perSize, i, 0.0).xyz;
  }
  let world = vec3f(rest.x + moved.x, moved.y, rest.y + moved.z);

  let wide = mix(SMALLEST, LARGEST, drop.size);
  let eye = world - scene.eyeTime.xyz;
  let depth = dot(eye, scene.forward.xyz);
  if (depth < NEAREST_SPLASH * 0.5) {
    return gone();
  }
  let perMetre = scene.up.w * 0.5 * scene.pixels.x / depth;
  let pixels = wide * perMetre;
  let drawn = max(pixels, FEWEST_PIXELS) / perMetre;

  let side = (f32(corner & 1u) * 2.0 - 1.0) * QUAD_SIDE;
  let up = select(-QUAD_DOWN, QUAD_UP, (corner >> 1u) == 0u);
  let place = world + vec3f(1.0, 0.0, 0.0) * side * drawn + vec3f(0.0, 1.0, 0.0) * up * drawn;
  let seen = clipOf(place);
  // As a low view sees it, what's in front of the drop lies under the quad's foot, so
  // the water there would hide it. Its depth is that of the water at the quad's foot.
  let ahead = QUAD_DOWN * drawn * depth / scene.eyeTime.y;
  let clip = vec4f(seen.xy, scene.forward.w * seen.w / max(seen.w - ahead, scene.forward.w), seen.w);

  let overhead = scene.overhead.rgb;
  let light = sunlight() * saturate(scene.sun.w) + moonlight() * 0.3 + overhead * PI * 1.3;
  let strength = pow(saturate(pixels / drawn), 1.5) * 0.75;
  return Splash(
    clip,
    vec2f(side, up),
    drop.age / lasts,
    scattered(chosen + 2u),
    1.0 / max(pixels, 1.0),
    strength,
    light * SPRAY
  );
}

// A soft-edged spot, in widths.
fn spot(at: vec2f, centre: vec2f, radius: f32, soft: f32) -> f32 {
  return 1.0 - smoothstep(radius - soft, radius + soft, length(at - centre));
}

// What is seen of a small splash, or of any from far off: a fleck of spray, a spike of
// water with a smudge at its foot, rising at once and sinking back.
fn fleck(at: vec2f, life: f32, own: f32) -> f32 {
  let height = sin(sqrt(life) * PI) * (1.1 + own * 1.1);
  let narrow = at.x / (0.2 + 0.16 * life);
  let spike = exp(-narrow * narrow) * smoothstep(-0.15, 0.2, at.y) * (1.0 - smoothstep(height * 0.55, height, at.y));
  let low = at.y / 0.24;
  let smudge = exp(-at.x * at.x / 0.5 - low * low) * (1.0 - life);
  return max(spike, smudge * 0.7);
}

// The ring of water thrown up around the crater, its top torn into fingers.
fn crown(at: vec2f, life: f32, own: f32, soft: f32) -> f32 {
  let rises = saturate(life / 0.5);
  if (rises >= 1.0) {
    return 0.0;
  }
  let radius = 0.5 + 0.55 * sqrt(rises);
  let across = at.x / radius;
  if (abs(across) >= 1.0) {
    return 0.0;
  }
  // Seen from a little above, the ring is an ellipse.
  let flat_ = 0.24 * radius * sqrt(1.0 - across * across);
  let torn = 0.5 + 0.3 * sin(across * (7.0 + own * 6.0) + own * 40.0) + 0.2 * sin(across * 19.0 + own * 71.0);
  let top = sin(rises * PI) * (0.55 + 0.45 * own) * (0.3 + 1.1 * torn * torn);
  let foot = smoothstep(-flat_ - soft, -flat_ + soft, at.y);
  let inside = 1.0 - smoothstep(top + flat_ - soft * 2.0, top + flat_ + soft * 2.0, at.y);
  let rim = smoothstep(top - flat_ - soft * 3.0, top - flat_ + soft, at.y);
  // The wall is a sheet thin enough to see through, and its top a thick, bright rim.
  return foot * inside * mix(0.12, 0.55, rim) * (1.0 - rises * rises);
}

// The jet that rises as the crater closes, thin at its tip, with the bead that breaks
// away from the top of it.
fn jet(at: vec2f, life: f32, own: f32, soft: f32) -> f32 {
  let up = saturate((life - 0.3) / 0.7);
  if (up <= 0.0 || up >= 1.0) {
    return 0.0;
  }
  let height = sin(up * PI) * (1.0 + own * 1.0);
  let along = saturate(at.y / max(height, 0.01));
  let wide = max(0.13 * (1.0 - along * 0.8) * (1.0 - up * 0.5), soft * 0.5);
  let stem = (1.0 - smoothstep(wide - soft, wide + soft, abs(at.x)))
    * smoothstep(-soft, soft, at.y)
    * (1.0 - smoothstep(height - soft, height + soft, at.y));
  return max(stem * 0.5, spot(at, vec2f(0.0, height + 0.05), 0.07, soft) * 0.7);
}

// The droplets it throws, each on its own arc, falling back under gravity.
fn droplets(at: vec2f, life: f32, own: f32, soft: f32) -> f32 {
  var total = 0.0;
  for (var i = 0; i < DROPLETS; i++) {
    let which = f32(i) + own * 31.0;
    let angle = fract(which * 0.618034) * 2.0 - 1.0;
    let thrown = 0.6 + fract(which * 0.3819) * 1.3;
    let flight = saturate((life - 0.04) / 0.96);
    let centre = vec2f(angle * thrown * 1.1 * flight, thrown * 2.6 * flight * (1.0 - flight));
    let radius = 0.04 + 0.04 * fract(which * 0.7548);
    total += spot(at, centre, radius, soft) * (1.0 - flight * flight) * 0.7;
  }
  return min(total, 1.0);
}

@fragment
fn splashFragment(splash: Splash) -> @location(0) vec4f {
  let soft = max(splash.pixel, 0.03);
  var cover = fleck(splash.at, splash.life, splash.own);
  let detail = smoothstep(DETAILED * 0.5, DETAILED, 1.0 / splash.pixel);
  if (detail > 0.0) {
    let made = max(
      max(crown(splash.at, splash.life, splash.own, soft), jet(splash.at, splash.life, splash.own, soft)),
      droplets(splash.at, splash.life, splash.own, soft)
    );
    cover = mix(cover, made, detail);
  }
  let alpha = cover * splash.strength * (1.0 - smoothstep(0.8, 1.0, splash.life));
  if (alpha <= 0.002) {
    discard;
  }
  return vec4f(display(splash.radiance, splash.position.xy) * alpha, alpha);
}
`
