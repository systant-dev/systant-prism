// WGSL for the night sky: its uniforms, the stars, the Milky Way as the sky's shader
// adds it, and the baking of the Milky Way.
import { RADIANS } from '../daylight'
import { cross } from '../maths'
import { noiseSource } from '../moon'
import { horizonVeilSource, overSource, wgslFloat as f } from '../sharedShaders'
import { BULGE, DARK_CLOUDS, DISK_LOBES, STAR_CLOUDS } from './catalog'
import { type Placed, placeAll, placeDeepSky } from './milkyWay'
import { COLOUR_STOPS, INDEX_RANGE, MAGNITUDE_RANGE } from './stars'

/** How many values heavensAt gives. */
export const HEAVENS_TURN_SIZE = 24

/** Where each of the rest of what the shaders are told about the night sky goes, in the heavens uniforms. */
export const HEAVENS = {
  /** The size of a pixel in clip space, how far the stars are out, and the target's height in 1080s. */
  pixel: 24,
  /** How far rain cloud has drifted in the plane, then how far its shapes have changed. */
  rainCloud: 28,
  /** How far the Milky Way is out. */
  night: 32,
  /** The sky's lens, as the right, up and forward of a camera, each with what scales it in clip space. */
  lens: 36,
  /** The way to the moon through the sky's lens, then how much of it shows. */
  moon: 48,
  /**
   * Where the clouds, their regions and their bends have drifted to, in tiles of their
   * noise, then how far their shapes have turned over, in tiles (clouds.ts).
   */
  clouds: 52,
  /** Where in their steps this lighting of the clouds starts, as a share of a step, then how many lightings it averages. */
  cloudSteps: 56,
  /** The way to the sun through the sky's lens, then the sine of its real height. */
  sun: 60,
} as const

/** How many values the heavens uniforms hold. */
export const HEAVENS_SIZE = 64

/** The Milky Way's brightest, as baked: what is brighter is cut off. Its square root is what is kept. */
const GLOW_RANGE = 2

/**
 * The size of the baked Milky Way, and how far it reaches either side of the galaxy's
 * plane, in radians: past about 60° there is nothing the eye sees, so it is left out,
 * with pixels as wide as they are tall.
 */
export const GALAXY_SIZE: [number, number] = [4096, 1376]

/**
 * How many mips the baked Milky Way has, for it to blur into the haze over an open
 * horizon: down to texels 32 wide, about 3°, which 1376 halves to evenly.
 */
export const GALAXY_MIPS = 6
const GALAXY_REACH = (Math.PI * GALAXY_SIZE[1]) / GALAXY_SIZE[0]

/** The night sky's own uniforms, as a struct, for any shader that reads them. */
const heavensStruct = /* wgsl */ `
struct Heavens {
  // The rows that turn a star's way to where it lies from the ground.
  turnX: vec4f,
  turnY: vec4f,
  turnZ: vec4f,
  // Those for the galaxy's axes: the way to each, from the ground.
  galaxyX: vec4f,
  galaxyY: vec4f,
  galaxyZ: vec4f,
  // The size of a pixel, in clip space, then how far the stars have come out, then
  // the target's height as a share of 1080 pixels.
  pixel: vec2f,
  out: f32,
  scale: f32,
  // How far rain cloud has drifted in the plane, then how far its shapes have changed.
  rainCloud: vec4f,
  // How far the Milky Way has come out.
  night: vec4f,
  // The lens every scene sees the night sky through, the ocean's, as wide and as tall as
  // the scene's own lens makes its view: each with what scales it in clip space. A star
  // is drawn where this lens puts it on the screen, so it stays put as one scene gives
  // way to another, as the sun and moon do.
  skyRight: vec4f,
  skyUp: vec4f,
  skyForward: vec4f,
  // The way to the moon through that lens, then how much of it shows.
  moon: vec4f,
  // Where the clouds, their regions and their bends have drifted to, in tiles of their
  // noise, then how far their shapes have turned over.
  clouds: vec4f,
  // Where in their steps this lighting of them starts, as a share of a step, then how many
  // lightings it averages, each further on.
  cloudSteps: vec4f,
  // The way to the sun through the sky's lens, then the sine of its real height.
  sun: vec4f,
}
`

/**
 * Between places on the screen, in clip space, and the ways to what is drawn there, through
 * the sky's lens and through the scene's own: for a shader with both their uniforms.
 */
const lensSource = /* wgsl */ `
// Clip space at a place on the target, 0–1 from its top left, and back.
fn ndcOf(uv: vec2f) -> vec2f {
  return vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
}

fn uvOf(ndc: vec2f) -> vec2f {
  return vec2f(ndc.x, -ndc.y) * 0.5 + 0.5;
}

// Where the sky's lens puts the way d on the screen, in clip space, given that it is in front.
fn skyOnScreen(d: vec3f, depth: f32) -> vec2f {
  return vec2f(dot(d, heavens.skyRight.xyz) * heavens.skyRight.w, dot(d, heavens.skyUp.xyz) * heavens.skyUp.w) / depth;
}

// The way through the sky's lens to what is drawn at this place on the screen, in clip space.
fn skyWay(ndc: vec2f) -> vec3f {
  return normalize(
    heavens.skyForward.xyz + heavens.skyRight.xyz * ndc.x / heavens.skyRight.w + heavens.skyUp.xyz * ndc.y / heavens.skyUp.w
  );
}

// Where the scene's own lens puts the way d on the screen, given that it is in front.
fn sceneOnScreen(d: vec3f, depth: f32) -> vec2f {
  return vec2f(dot(d, scene.right.xyz) * scene.right.w, dot(d, scene.up.xyz) * scene.up.w) / depth;
}

// The way through the scene's own lens to what is drawn at this place on the screen.
fn sceneWayAt(ndc: vec2f) -> vec3f {
  return normalize(scene.forward.xyz + scene.right.xyz * ndc.x / scene.right.w + scene.up.xyz * ndc.y / scene.up.w);
}

// The way through the scene's own lens to where the sky's lens puts the way d, given that it is in front.
fn sceneWay(d: vec3f) -> vec3f {
  return sceneWayAt(skyOnScreen(d, max(dot(d, heavens.skyForward.xyz), 1e-4)));
}
`

/** The night sky's uniforms bound at group 0, binding 1, for a shader of the sky's own. */
export const heavensBindingSource = /* wgsl */ `
${heavensStruct}
@group(0) @binding(1) var<uniform> heavens: Heavens;
${lensSource}
`

/** How much of the stars and the Milky Way shows over an open horizon, through its haze. */
const starHaze = /* wgsl */ `
// How far over an open horizon the stars and the Milky Way start to fade into its haze,
// and how far below it they blur on over the far water, each as a share of how far the
// sun and moon sink into it: about 140 rows of a view 1080 high, then 80. Above that
// they are as bright as anywhere.
const STAR_HAZE_ABOVE = 4.0;
const STAR_HAZE_BELOW = 2.4;
// How much of their light is left where the water meets the sky.
const STAR_HAZE_HORIZON = 0.3;
// How many times wider a star spreads, at the most, as the haze blurs it.
const STAR_BLUR = 2.0;
// How thick the low air is to the Milky Way, which the sky leaves out but the ocean's
// mirror, which looks almost all along the horizon, sees it through.
const MILKY_WAY_AIR = 0.06;

// How much of the stars and the Milky Way shows this high over the horizon, through
// the haze along it: all of it where a scene hides its horizon, as the forest does
// behind its trees. Over the ocean they fade slowly down to the water, then blur on over
// the far water to nothing (surfaceShaders.ts), with no crease where the two meet.
fn starHaze(y: f32) -> f32 {
  if (HORIZON_VEIL <= 0.0) {
    return 1.0;
  }
  if (y >= 0.0) {
    return mix(STAR_HAZE_HORIZON, 1.0, smoothstep(0.0, VEIL_EDGE * STAR_HAZE_ABOVE, y));
  }
  return STAR_HAZE_HORIZON * (1.0 - smoothstep(0.0, VEIL_EDGE * STAR_HAZE_BELOW, -y));
}

// How far the haze blurs the stars and the Milky Way this high over the horizon, 0–1:
// growing over the same height as they fade, so that they soften into the light along
// the horizon rather than only dim, and all of it on and below the horizon itself.
fn starBlur(y: f32) -> f32 {
  if (HORIZON_VEIL <= 0.0) {
    return 0.0;
  }
  let low = 1.0 - smoothstep(0.0, VEIL_EDGE * STAR_HAZE_ABOVE, y);
  return low * low;
}

// How much of the Milky Way at this height the ocean mirrors, through all of the low air
// it looks along: or the glow of the low sky would light the water.
fn mirroredAir(y: f32) -> f32 {
  return exp(-MILKY_WAY_AIR * airMass(y * 2.0));
}
`

/** A star as seen: where it is, how bright and how big, and the quad that draws it as a point of light. */
const starLight = /* wgsl */ `
// How many magnitudes of stars twilight takes away, at the most.
const TWILIGHT_MAGNITUDES = 11.0;
// The spread of a star's core, in pixels of a target 1080 high: well under a pixel, for
// a point of light, and no less, or it would flicker as it crossed from one to the next.
// The brightest grow to the largest.
const STAR_SPREAD = 0.6;
const LARGEST_SPREAD = 1.1;
// How far a star's quad reaches, in spreads, and further for the halo of the brightest.
const STAR_REACH = 3.5;
const HALO_REACH = 9.0;
// The magnitude that shows at full strength, and how much of a magnitude's real step
// in brightness is kept: their true range is far more than a screen can show.
const FULL_MAGNITUDE = 4.2;
const MAGNITUDE_STEP = 0.09;
// How bright a star's halo is, at its brightest, against its core.
const HALO = 0.1;
// How much of its own colour a star keeps: to the eye, by night, nearly all are white.
const STAR_TINT = 0.3;

const COLOUR_AT = array<f32, ${COLOUR_STOPS.length}>(${COLOUR_STOPS.map(([at]) => f(at)).join(', ')});
const COLOUR = array<vec3f, ${COLOUR_STOPS.length}>(${COLOUR_STOPS.map(([, c]) => `vec3f(${c.map(f).join(', ')})`).join(', ')});

// A star's colour from its B−V index, as starColour gives it.
fn starColour(index: f32) -> vec3f {
  var colour = COLOUR[0];
  for (var i = 1; i < ${COLOUR_STOPS.length}; i++) {
    let t = saturate((index - COLOUR_AT[i - 1]) / (COLOUR_AT[i] - COLOUR_AT[i - 1]));
    colour = select(colour, mix(COLOUR[i - 1], COLOUR[i], t), index > COLOUR_AT[i - 1]);
  }
  return colour;
}

// A star as the eye sees it: the way to it from the ground, its light, none when it
// can't be seen, how far its core spreads, in pixels, and how bright its halo is.
struct SeenStar {
  d: vec3f,
  light: vec3f,
  spread: f32,
  halo: f32,
}

// A star from its place in the instance buffer, by the night as it stands: twilight,
// the haze over an open horizon and the moon's light all take from it. Those that blur
// through an open horizon are hidden by the water; where a scene hides its horizon,
// what hides it covers them.
fn seenStar(place: vec2f, packed: vec4f) -> SeenStar {
  let ascension = place.x * 2.0 * PI;
  let declination = (place.y - 0.5) * PI;
  let at = vec3f(cos(declination) * cos(ascension), cos(declination) * sin(ascension), sin(declination));
  let magnitude = mix(${f(MAGNITUDE_RANGE[0])}, ${f(MAGNITUDE_RANGE[1])}, packed.x);
  let d = vec3f(dot(heavens.turnX.xyz, at), dot(heavens.turnY.xyz, at), dot(heavens.turnZ.xyz, at));
  // Twilight takes the faintest first and leaves the brightest till last.
  let twilight = saturate((heavens.out * TWILIGHT_MAGNITUDES - magnitude - 1.5) * 0.5) * (1.0 - scene.wind.w);
  let air = starHaze(d.y);
  if (air <= 0.0 || twilight <= 0.0) {
    return SeenStar(d, vec3f(0.0), 0.0, 0.0);
  }
  // Thick air shakes them, and moonlight drowns those close to the moon.
  let washed = 1.0 - 0.65 * heavens.moon.w * exp(-length(d - heavens.moon.xyz) / 0.16);
  let shaking = (1.0 - saturate(d.y * 5.0)) * 0.3 + 0.08;
  let twinkle = 1.0 + shaking * sin(scene.eyeTime.w * (4.0 + fract(at.x * 91.0) * 6.0) + at.y * 917.0);
  let brightness = pow(10.0, -MAGNITUDE_STEP * (magnitude - FULL_MAGNITUDE));
  let tint = mix(vec3f(1.0), starColour(mix(${f(INDEX_RANGE[0])}, ${f(INDEX_RANGE[1])}, packed.y)), STAR_TINT);
  // Low over an open horizon the haze spreads each one out, keeping its light.
  let blurred = 1.0 + (STAR_BLUR - 1.0) * starBlur(d.y);
  let spread = min(STAR_SPREAD * (1.0 + 0.12 * max(FULL_MAGNITUDE - magnitude, 0.0)), LARGEST_SPREAD) * max(heavens.scale, 0.75) * blurred;
  let light = tint * min(brightness, 1.0) * twilight * air * washed * twinkle / (blurred * blurred);
  return SeenStar(d, light, spread, HALO * saturate((1.5 - magnitude) / 3.0));
}

// How far a star's quad reaches, in spreads of its core.
fn starReach(star: SeenStar) -> f32 {
  return select(STAR_REACH, HALO_REACH, star.halo > 0.0);
}

// The angle a pixel takes up, in radians, near the middle of the view.
fn pixelAngle() -> f32 {
  return heavens.pixel.y / scene.up.w;
}

struct Star {
  @builtin(position) position: vec4f,
  // Where in the quad, in spreads of its core from the star.
  @location(0) spot: vec2f,
  // Its light, then how bright its halo is, then how far the quad reaches, in spreads.
  @location(1) @interpolate(flat) light: vec4f,
  @location(2) @interpolate(flat) reach: f32,
}

// A quad that goes nowhere, for a star that can't be seen, so that it costs only its vertices.
fn noStar() -> Star {
  return Star(vec4f(2.0, 2.0, 0.0, 1.0), vec2f(0.0), vec4f(0.0), 0.0);
}

// A corner of the quad of a star seen in the way d from the eye, with this light.
fn starQuad(index: u32, d: vec3f, star: SeenStar, light: vec3f) -> Star {
  let depth = dot(d, heavens.skyForward.xyz);
  if (depth <= 0.05) {
    return noStar();
  }
  let reach = starReach(star);
  let unit = vec2f(f32(index & 1u), f32(index >> 1u)) * 2.0 - 1.0;
  let centre = skyOnScreen(d, depth);
  let clip = centre + unit * reach * star.spread * heavens.pixel;
  return Star(vec4f(clip, 0.0, 1.0), unit * reach, vec4f(light, star.halo), reach);
}

@fragment
fn starFragment(star: Star) -> @location(0) vec4f {
  let r2 = dot(star.spot, star.spot);
  let core = exp(-0.5 * r2);
  // Fading to nothing at the edge of the quad.
  let halo = star.light.a * exp(-sqrt(r2) * 0.6) * saturate(1.0 - r2 / (star.reach * star.reach));
  return vec4f(star.light.rgb * (core + halo), 0.0);
}
`

/** The Milky Way's light in a direction, from the baked texture. */
const milkyWayLight = /* wgsl */ `
// How bright the Milky Way is, at its brightest, in the sky's radiance.
const MILKY_WAY = 0.7;
// Its colour: a cold grey along most of it, as the eye sees by night, and warmer in
// the old stars of the bulge.
const MILKY_WAY_COLD = vec3f(0.82, 0.88, 1.0);
const MILKY_WAY_WARM = vec3f(1.0, 0.9, 0.76);
// How much a moon in the sky takes of it, and how far round the moon it drowns it, in radians.
const MOON_DROWNS = 0.1;
const MOON_GLARE = 0.3;
const GALAXY_REACH = ${f(GALAXY_REACH)};

fn milkyWay(d: vec3f) -> vec3f {
  return milkyWayBlurred(d, 0.0);
}

// The same, read no sharper than this mip of the baked texture: for what sees it
// blurred, as rough water mirrors it.
fn milkyWayBlurred(d: vec3f, least: f32) -> vec3f {
  let air = starHaze(d.y);
  if (heavens.night.x <= 0.0 || air <= 0.0) {
    return vec3f(0.0);
  }
  let g = vec3f(dot(heavens.galaxyX.xyz, d), dot(heavens.galaxyY.xyz, d), dot(heavens.galaxyZ.xyz, d));
  let latitude = asin(clamp(g.z, -1.0, 1.0));
  let uv = vec2f(atan2(g.y, g.x) / (2.0 * PI) + 0.5, 0.5 - latitude / (2.0 * GALAXY_REACH));
  // Its shapes soften into the haze low over an open horizon: a blurrier mip, the lower.
  let blur = max(starBlur(d.y) * ${f(GALAXY_MIPS - 1)}, least);
  let kept = select(0.0, textureSampleLevel(galaxy, repeating, uv, blur).r, abs(latitude) < GALAXY_REACH);
  let light = kept * kept * ${f(GLOW_RANGE)};
  let warmth = smoothstep(0.82, 1.0, g.x) * exp(-g.z * g.z / 0.03);
  let colour = mix(MILKY_WAY_COLD, MILKY_WAY_WARM, warmth);
  let fromMoon = length(d - heavens.moon.xyz);
  let washed = (1.0 - MOON_DROWNS * heavens.moon.w) * (1.0 - 0.6 * heavens.moon.w * exp(-fromMoon / MOON_GLARE));
  return colour * light * MILKY_WAY * heavens.night.x * air * washed;
}
`

/**
 * The stars as the sky draws them, behind the discs of the sun and moon, with the
 * night sky's uniforms bound beside the scene's.
 */
export const heavensSource = /* wgsl */ `
${heavensBindingSource}
${starHaze}
${starLight}

// How much of a star shows past the discs of the moon and the sun, which lie in front
// of it: none once it is behind either, and all once it is reach radians clear.
fn pastDiscs(d: vec3f, reach: f32) -> f32 {
  let moonSize = MOON_RADIUS * vec2f(scene.moonlit.w, scene.clouded.w);
  let sunSize = SUN_RADIUS * vec2f(scene.sunlit.w, scene.skylit.w);
  let moon = smoothstep(1.0, 1.0 + MOON_EDGE + reach / min(moonSize.x, moonSize.y), length(onDisc(d, scene.moon.xyz, moonSize)));
  let sun = smoothstep(1.0, 1.0 + SUN_EDGE + reach / min(sunSize.x, sunSize.y), length(onDisc(d, scene.sun.xyz, sunSize)));
  return select(1.0, moon, scene.moon.w > 0.0) * sun;
}


// A star in the sky: a point of light, with a faint halo round the brightest.
@vertex
fn starVertex(
  @builtin(vertex_index) index: u32,
  @location(0) place: vec2f,
  @location(1) packed: vec4f
) -> Star {
  let star = seenStar(place, packed);
  if (max(star.light.r, star.light.g) <= 0.0) {
    return noStar();
  }
  // The discs are where the scene's own lens puts them.
  // Cloud lies in front of it too, where the sky's lens puts it, as it does the cloud.
  let depth = dot(star.d, heavens.skyForward.xyz);
  let clear = select(1.0, cloudClearAt(skyOnScreen(star.d, max(depth, 1e-4))), depth > 0.05);
  let behind = pastDiscs(sceneWay(star.d), star.spread * starReach(star) * 0.5 * pixelAngle()) * clear;
  if (max(star.light.r, star.light.g) * behind <= 0.0) {
    return noStar();
  }
  return starQuad(index, star.d, star, star.light * behind);
}
`

/** The Milky Way in the sky's radiance, for the sky's own fragment shader. */
export const milkyWaySource = /* wgsl */ `
@group(0) @binding(2) var galaxy: texture_2d<f32>;
@group(0) @binding(3) var repeating: sampler;
${milkyWayLight}
`

/**
 * The night sky for a scene that reflects it, in a group of its own: its uniforms at
 * binding 0, the baked Milky Way at 1 and its sampler at 2, and the clouds as lit this
 * frame at 3 with their sampler at 4. With them, the Milky Way's light and the clouds',
 * for the scene to mirror. Stars it leaves out: on moving water each would only
 * be a glint that jumps from wave to wave.
 */
export function reflectedHeavensSource(group: number) {
  return /* wgsl */ `
${heavensStruct}
@group(${group}) @binding(0) var<uniform> heavens: Heavens;
@group(${group}) @binding(1) var galaxy: texture_2d<f32>;
@group(${group}) @binding(2) var repeating: sampler;
@group(${group}) @binding(3) var clouds: texture_2d<f32>;
@group(${group}) @binding(4) var clamped: sampler;
${lensSource}
${horizonVeilSource}
${starHaze}
${milkyWayLight}

// The clouds in the way d, which is above the horizon, where the sky's lens puts it on the
// screen, blurred to this mip of their texture: their premultiplied light, and how much of
// the sky behind they hide. What lies above the top of the view isn't known, so they fade
// out a little way past it, and the sky there is mirrored clear.
fn cloudsIn(d: vec3f, blur: f32) -> vec4f {
  let depth = dot(d, heavens.skyForward.xyz);
  if (depth <= 0.05) {
    return vec4f(0.0);
  }
  let ndc = skyOnScreen(d, depth);
  let known = 1.0 - smoothstep(0.85, 1.15, ndc.y);
  if (known <= 0.0) {
    return vec4f(0.0);
  }
  return textureSampleLevel(clouds, clamped, uvOf(ndc), blur) * known;
}
`
}

/** A number as WGSL, short. */
const n = (value: number) => {
  const text = `${+value.toFixed(6)}`
  return /[.e]/.test(text) ? text : `${text}.0`
}
const v3 = (values: readonly number[]) => `vec3f(${values.map(n).join(', ')})`

/**
 * A call that measures a placed patch at q, with all it needs as literals, for the
 * compiler to fold: a constant array indexed in a loop would be copied into every
 * pixel's own memory instead, which on some GPUs costs more than all the rest.
 */
function patchCall({ middle, length, patch }: Placed) {
  const side = cross(middle, length)
  return `patchAt(q, ${v3(middle)}, ${v3(length)}, ${v3(side)}, vec2f(${n(1 / (patch.long * RADIANS))}, ${n(1 / (patch.wide * RADIANS))}))`
}

/** How far a patch reaches, as the cosine of the angle from its middle past which it is nothing. */
const reachOf = ({ patch }: Placed) =>
  n(Math.cos(Math.min(Math.PI / 2, 4 * Math.max(patch.long, patch.wide) * RADIANS)))

/** Made by a function, or a bundle without a sky would keep all that it is made from. */
function galaxyShader() {
  const lobes = [...DISK_LOBES, BULGE]
  const clouds = placeAll(STAR_CLOUDS, false)
  const dust = placeAll(DARK_CLOUDS, false)
  const glows = placeDeepSky()
  const kinds = { galaxy: 'smooth', nebula: 'mottled', cluster: 'tight' }
  return /* wgsl */ `
${noiseSource}
${overSource}

const PI = 3.14159265;
const GALAXY_REACH = ${n(GALAXY_REACH)};
// How far from the plane, in radians, the band's own clouds, its dust and the lanes along it are worked out.
const BAND_REACH = 0.62;
const LANE_REACH = 0.09;

// How strongly a patch reaches q, 0–1: a Gaussian across it, and none behind it.
fn patchAt(q: vec3f, middle: vec3f, length: vec3f, side: vec3f, over: vec2f) -> f32 {
  let along = dot(q, length) * over.x;
  let across = dot(q, side) * over.y;
  return select(0.0, exp(-0.5 * (along * along + across * across)), dot(q, middle) > 0.0);
}

// A lobe of the band at a galactic longitude and latitude: where it is, and one over each spread.
fn lobe(longitude: f32, latitude: f32, at: vec4f) -> f32 {
  var across = longitude - at.x;
  across -= 2.0 * PI * round(across / (2.0 * PI));
  let along = across * at.z;
  let up = (latitude - at.y) * at.w;
  return exp(-0.5 * (along * along + up * up));
}

// How a dark cloud stops the light behind it, from how far it reaches: torn into
// filaments, whose edges are sharp, as the eye sees them.
fn darkened(reach: f32, torn: f32, strength: f32) -> f32 {
  return 1.0 - strength * smoothstep(0.06, 0.95, reach * (0.2 + 1.25 * torn));
}

@fragment
fn galaxyFragment(over: Over) -> @location(0) vec4f {
  let longitude = (over.uv.x - 0.5) * 2.0 * PI;
  let latitude = (0.5 - over.uv.y) * 2.0 * GALAXY_REACH;
  let q = vec3f(cos(latitude) * cos(longitude), cos(latitude) * sin(longitude), sin(latitude));

  // The band, in lobes along the plane.
  var band = 0.0;
  ${lobes
    .map(
      ({ at, long, wide, strength }) =>
        `band += ${n(strength)} * lobe(longitude, latitude, vec4f(${n(at[0] * RADIANS)}, ${n(at[1] * RADIANS)}, ${n(1 / (long * RADIANS))}, ${n(1 / (wide * RADIANS))}));`,
    )
    .join('\n  ')}

  var light = band;
  let grain = moonNoise(q * 260.0) * 0.5 + moonNoise(q * 520.0) * 0.5;
  if (abs(latitude) < BAND_REACH) {
    // Broken into clouds of stars at three sizes, with a grain of stars too faint to see one by one.
    let clouds = moonOctaves(q * 11.0) * 0.45 + moonOctaves(q * 34.0) * 0.55;
    let fine = moonOctaves(q * 95.0);
    light = band * (0.25 + 1.5 * clouds * clouds) * (0.55 + 0.9 * fine);
    ${clouds.map((cloud) => `light += ${n(cloud.patch.strength)} * ${patchCall(cloud)} * (0.55 + 0.9 * fine);`).join('\n    ')}

    // Dust in front of it: the great lanes and clouds, with edges pushed about so
    // that none is the shape it was given, and thinner lanes wandering along the plane.
    let warp = vec3f(moonOctaves(q * 8.0 + 1.0), moonOctaves(q * 8.0 + 5.0), moonOctaves(q * 8.0 + 9.0)) - 0.5;
    let w = normalize(q + warp * 0.06);
    let torn = (1.0 - abs(2.0 * moonOctaves(w * 36.0) - 1.0)) * (0.6 + 0.5 * moonOctaves(w * 110.0));
    var through = 1.0;
    ${dust.map((lane) => `through *= darkened(${patchCall(lane).replace('patchAt(q,', 'patchAt(w,')}, torn, ${n(lane.patch.strength)});`).join('\n    ')}
    if (abs(latitude) < LANE_REACH) {
      let wander = latitude - (moonOctaves(vec3f(q.xy * 5.0, 2.0)) - 0.5) * 0.04;
      let lane = smoothstep(0.52, 0.7, moonOctaves(w * vec3f(18.0, 18.0, 46.0) + 3.0));
      through *= 1.0 - 0.35 * lane * exp(-wander * wander / 0.0005);
    }
    light *= through;
  }
  light *= 0.75 + 0.5 * grain;

  // The glows beyond the band, each worked out only near it: galaxies smooth, nebulae mottled, clusters tight.
  ${glows
    .map((glow, i) => {
      const at = `${patchCall(glow)}`
      const shape = {
        smooth: at,
        mottled: `${at} * (0.6 + 0.8 * moonOctaves(q * 600.0 + ${n(i)}))`,
        tight: `pow(${at}, 1.6)`,
      }[kinds[glow.patch.kind]]
      return `if (dot(q, ${v3(glow.middle)}) > ${reachOf(glow)}) {\n    light += ${n(glow.patch.strength)} * ${shape} * (0.85 + 0.3 * grain);\n  }`
    })
    .join('\n  ')}

  return vec4f(sqrt(saturate(light / ${n(GLOW_RANGE)})), 0.0, 0.0, 1.0);
}
`
}

/** Bakes the Milky Way, once, into a texture of its brightness across the galaxy's own longitude and latitude. */
export const galaxySource = /* @__PURE__ */ galaxyShader()
