// WGSL for the sky over any scene: the fields of its uniforms that every scene
// starts with, the light of the sky, and how a radiance becomes a pixel. A scene
// declares its own `Scene` struct, starting with skyFieldsSource, and a binding of
// it as `scene`, then takes these in after that.
//
// The sky is single scattering in a closed form: light scatters out of the sun
// and into the view, in the proportions of Rayleigh's and Mie's phase functions,
// over as much air as the view passes through. It costs a few instructions per
// pixel, so a scene can ask it for reflections and haze too.
//
// How bright that is goes by the real height of the sun (daylight.ts), not by where
// its disc is drawn: it is what reddens the light towards sunset and takes it away
// after, through a twilight as long as the sun takes to sink 6°. What is left is
// the night sky, with the moon in it.
//
// The moon is always full and the night always clear. Its true light is 400,000
// times weaker than the sun's, which no screen could show and no eye would see as
// black: the eye adapts. So it is exposed as a moonlit night is on film, about a
// tenth of the sun. That lights the air as the sun does, so the sky is a deep
// version of the day's blue, against which a dark hill stands out.
import { cloudCoverSource } from './cloudShaders'
import { DISC_FLATTEST, DISC_ROUND_BY } from './daylight'
import { moonSource } from './moon'
import { horizonVeilSource, interleavedSource, overSource } from './sharedShaders'
import {
  MIE,
  MIE_FORWARD,
  MOON_FORWARD,
  MOON_HEIGHT,
  MOON_SKY,
  MOONLIGHT,
  NIGHT_HORIZON,
  NIGHT_ZENITH,
  RAYLEIGH,
  THROUGH_RAIN_CLOUD,
} from './skyLight'
import { heavensSource, milkyWaySource } from './heavens/heavensShaders'

export { SKY_UNIFORM, SKY_UNIFORMS_SIZE } from './skyLight'

const vec3 = (values: number[]) => `vec3f(${values.join(', ')})`

/**
 * The moon's disc, for what has to know how far across the screen it reaches
 * (moonFace.ts): how wide it is, in radians, through the forest's long lens, how far its
 * edge is blurred, as a share of it, and how much more of it is where the haze has it all.
 */
export const MOON_RADIUS = 0.019
export const MOON_EDGE = 0.13
export const VEILED_EDGE = 0.35

/** The fields every `Scene` struct starts with, in order. */
export const skyFieldsSource = /* wgsl */ `
  // Each with what scales it in clip space, or the near depth.
  right: vec4f,
  up: vec4f,
  forward: vec4f,
  eyeTime: vec4f,
  // The way to the sun's disc, then the sine of the real sun's height.
  sun: vec4f,
  // The way to the moon's disc, then how much of it shows, 0–1.
  moon: vec4f,
  // The way the wind blows in the plane, then how far the moon's face has turned and
  // how hard it is raining, 0–1.
  wind: vec4f,
  // The light as it stands (skyLight.ts): of the sun and moon as they reach the ground,
  // of the sun as it reaches the sky, and on the underside of rain cloud. With them,
  // how much wider and taller than as sized the discs are drawn: the sun's with the
  // first two, the moon's with the last two.
  sunlit: vec4f,
  skylit: vec4f,
  moonlit: vec4f,
  clouded: vec4f,
  // The sky straight overhead, and low ahead.
  overhead: vec4f,
  lowSky: vec4f,
`

export const skyLightSource = /* wgsl */ `
const PI = 3.14159265;
const RAYLEIGH = ${vec3(RAYLEIGH)};
const MIE = vec3f(${MIE});
const MIE_FORWARD = ${MIE_FORWARD};
const NIGHT_ZENITH = ${vec3(NIGHT_ZENITH)};
const NIGHT_HORIZON = ${vec3(NIGHT_HORIZON)};
const MOONLIGHT = ${vec3(MOONLIGHT)};
const MOON_HEIGHT = ${MOON_HEIGHT}.0;
const MOON_SKY = ${MOON_SKY};
const THROUGH_RAIN_CLOUD = ${THROUGH_RAIN_CLOUD};

// How much air a view this far above the horizon passes through, in atmospheres.
fn airMass(height: f32) -> f32 {
  let y = max(height, 0.0);
  return 1.0 / (y + 0.025 * exp(-11.0 * y));
}

// How far the sun's light has gone with it, 0–1, 6° below the horizon being none.
fn afterglow() -> f32 {
  let left = saturate((scene.sun.w + 0.1) / 0.1);
  return left * left;
}

// How much of the light of the sun and moon the cloud lets by, 0–1.
fn cloudCover() -> f32 {
  return mix(1.0, THROUGH_RAIN_CLOUD, scene.wind.w);
}

fn sunlight() -> vec3f {
  return scene.sunlit.rgb;
}

fn skylight() -> vec3f {
  return scene.skylit.rgb;
}

// How much of the light of something at this height comes through the air. The moon
// and the sun's disc have their heights in the sky: the moon stays low, so its
// height counts for five times as much to leave it white once well up.
fn throughAir(height: f32) -> vec3f {
  return exp(-(RAYLEIGH + MIE) * airMass(height));
}

fn moonlight() -> vec3f {
  return scene.moonlit.rgb;
}

fn henyeyGreenstein(cosine: f32, g: f32) -> f32 {
  let g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosine, 1.5));
}

// The sky in direction d, without the discs of the sun and moon: radiance in skyLight.ts.
fn skyRadiance(d: vec3f) -> vec3f {
  let cosine = dot(d, scene.sun.xyz);
  let rayleigh = RAYLEIGH * (3.0 / (16.0 * PI)) * (1.0 + cosine * cosine);
  let total = RAYLEIGH + MIE;
  // Softened a little: all of it saturates the view low in the sky, where this
  // view spends its time, to a paler blue than a clear day looks.
  let through = 1.0 - exp(-total * pow(airMass(d.y), 0.72));
  // The light scattered more than once, which keeps the sky from going dark overhead.
  let blue = skylight() * rayleigh / total * through * 1.25;
  // Haze, lit by the sun itself, so that it goes red around a low one.
  let glow = sunlight() * MIE * henyeyGreenstein(cosine, MIE_FORWARD) / total * through * 0.4;
  let night = mix(NIGHT_HORIZON, NIGHT_ZENITH, pow(saturate(d.y * 2.5), 0.6));
  // Scattered high up, over the low air that reddens the moon's disc.
  let moonlit = MOONLIGHT * scene.moon.w * RAYLEIGH / total * through * MOON_SKY * (3.0 / (16.0 * PI));
  let halo = moonlight() * henyeyGreenstein(dot(d, scene.moon.xyz), ${MOON_FORWARD}) * 0.003;
  // The underside of rain cloud is brighter overhead than low down.
  let rainy = scene.clouded.rgb * (0.85 + 0.6 * saturate(d.y));
  return mix(blue + glow + night + moonlit + halo, rainy, scene.wind.w);
}

// The core of the sun's glare, then the veil of it across the sky, as wide on the
// screen through any lens as its disc.
fn sunGlare(d: vec3f) -> vec3f {
  let away = length(d - scene.sun.xyz) / scene.sunlit.w;
  return sunlight() * (0.9 * exp(-away * 130.0) + 0.09 * exp(-away * 36.0) + 0.006 * exp(-away * 9.0));
}

fn aces(x: vec3f) -> vec3f {
  return saturate((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
}

${interleavedSource}

// To dither an 8-bit target out of banding across the sky's long, slow gradients.
fn dither(pixel: vec2f) -> f32 {
  return interleaved(pixel) - 0.5;
}

// A radiance as the sRGB-encoded value the rest of the backdrop treats images as.
fn display(radiance: vec3f, pixel: vec2f) -> vec3f {
  let mapped = aces(radiance * 0.42);
  let encoded = pow(mapped, vec3f(1.0 / 2.2));
  return encoded + dither(pixel) / 255.0;
}

// Where a place in the world falls on the target, as reversed depth.
fn clipOf(world: vec3f) -> vec4f {
  let eye = world - scene.eyeTime.xyz;
  return vec4f(
    dot(eye, scene.right.xyz) * scene.right.w,
    dot(eye, scene.up.xyz) * scene.up.w,
    scene.forward.w,
    dot(eye, scene.forward.xyz)
  );
}
`

/**
 * The sky, at full resolution, wherever the scene has left the target empty, with
 * the sun and moon in it.
 *
 * The sun is drawn as a camera sees it: too bright to have an edge by day, only a
 * core and its glare; a true disc only once the air has dimmed it, close to the
 * horizon, where it goes red from the bottom up, darker at its limb, and squashed by
 * refraction. The moon lies behind the air, so the sky is added over it, which is
 * what washes it out at dusk.
 *
 * All of it lies behind the clouds (clouds.ts), which are read from their own texture.
 */
export const skySource = /* @__PURE__ */ skyShader()

/** Made by a function, or a bundle without a sky would keep all that it is made from. */
function skyShader() {
  return /* wgsl */ `
${moonSource}
${heavensSource}
${milkyWaySource}
${cloudCoverSource}

// How wide the discs are, in radians, through the forest's long lens: through any
// other they are drawn as big on the screen (daylight.ts). The sun's is twice the
// real one there: its glare does the rest. The moon's is four times, or there would
// be no face to see.
const SUN_RADIUS = 0.0095;
const MOON_RADIUS = ${MOON_RADIUS};
// How far an edge is blurred, as a share of its disc.
const SUN_EDGE = 0.26;
const MOON_EDGE = ${MOON_EDGE};
// How bright the surface of each is, before the air.
const SUN_SURFACE = 25.0;
const MOON_SURFACE = vec3f(1.95, 2.05, 2.4);
// How dark the sun's limb is, against its middle.
const LIMB_DARKENING = 0.6;
// How low rain cloud starts to show its folds, as the sine of the height.
const CLOUD_FOLDS_START = 0.09;
// How dark and bright its folds go, as shares of its light.
const CLOUD_FOLD_DARK = 0.5;
const CLOUD_FOLD_BRIGHT = 1.45;
${horizonVeilSource}
// How much more of a disc's edge is blurred where the haze has it all.
const VEILED_EDGE = ${VEILED_EDGE};
// How much of the sun's and moon's discs show through rain cloud: each about half as bright
// on the screen as the moon is on a clear night, so the two look alike in the rain. The
// sun's is so much the brighter that far less of it does that.
const SUN_THROUGH_RAIN = 0.04;
const MOON_THROUGH_RAIN = 0.12;
// How much cloud hides all of the sky behind it: what shows through is under a step of 8 bits.
const CLOUD_HIDES = 0.998;

// The moon's face as it was last drawn (moonFace.ts): how bright its surface is at each
// pixel of the part of the target its disc falls in. That is most of what a pixel of the
// moon costs, and it stays as it is until the moon moves, about once a second.
struct MoonFacePart {
  // The part of the target it covers, in pixels: its left and top, then its width and height.
  pixels: vec4f,
  // The size of a pixel of the target, in clip space.
  pixel: vec4f,
}
@group(0) @binding(6) var moonFace: texture_2d<f32>;
@group(0) @binding(7) var<uniform> moonFacePart: MoonFacePart;

${overSource}

// How much of a disc shows through the haze this high in the sky, 0–1: none on the
// horizon itself, so that the water closes over nothing.
fn throughHaze(y: f32) -> f32 {
  if (HORIZON_VEIL <= 0.0) {
    return 1.0;
  }
  return smoothstep(0.0, VEIL_EDGE, y);
}

// How blurred a disc's edge is this high in the sky: its own, then more down in the haze.
fn edgeIn(edge: f32, y: f32) -> f32 {
  if (HORIZON_VEIL <= 0.0) {
    return edge;
  }
  return edge + VEILED_EDGE * (1.0 - smoothstep(0.0, VEIL_EDGE * 2.0, y));
}

// Where d falls on a disc around centre: 1 at its edge. Close to the horizon the
// air bends the bottom of a disc up more than its top, and flattens it.
fn onDisc(d: vec3f, centre: vec3f, radius: vec2f) -> vec2f {
  let side = normalize(cross(vec3f(0.0, 1.0, 0.0), centre));
  let rise = cross(centre, side);
  let flattened = mix(${DISC_FLATTEST}, 1.0, saturate(centre.y / ${DISC_ROUND_BY}));
  return vec2f(dot(d - centre, side), dot(d - centre, rise) / flattened) / radius;
}

fn sunDisc(d: vec3f) -> vec3f {
  let size = vec2f(scene.sunlit.w, scene.skylit.w);
  let r = length(onDisc(d, scene.sun.xyz, SUN_RADIUS * size));
  let blur = edgeIn(SUN_EDGE, d.y);
  let edge = (1.0 - smoothstep(1.0 - blur, 1.0 + blur, r)) * throughHaze(d.y);
  if (edge <= 0.0) {
    return vec3f(0.0);
  }
  let facing = sqrt(max(1.0 - r * r, 0.0));
  let limb = 1.0 - LIMB_DARKENING * (1.0 - facing);
  // Each part of the disc is behind its own depth of air, the lowest behind the most,
  // as it would be on a disc of the size it was sized at.
  let height = scene.sun.w + (d.y - scene.sun.y) / size.y;
  return SUN_SURFACE * limb * edge * throughAir(height) * afterglow() * mix(1.0, SUN_THROUGH_RAIN, scene.wind.w);
}

// Where on the moon's disc a pixel of the target looks, as onDisc has it. The way
// through the pixel is worked out from where it is, which is the same number in every
// pass, and not from the uv the rasteriser hands on, whose last bit goes by where the
// triangle lies on its target: so the surface as it was last drawn, in a pass of its
// own, is the one that would be worked out here.
fn moonAt(pixel: vec2f) -> vec2f {
  let ndc = vec2f(pixel.x * moonFacePart.pixel.x - 1.0, 1.0 - pixel.y * moonFacePart.pixel.y);
  return onDisc(sceneWayAt(ndc), scene.moon.xyz, MOON_RADIUS * vec2f(scene.moonlit.w, scene.clouded.w));
}

// How bright the moon's surface is at p on its disc, as far round as its face has turned.
fn moonSeen(p: vec2f) -> f32 {
  let turn = vec2f(cos(scene.wind.z), sin(scene.wind.z));
  let face = vec2f(p.x * turn.x - p.y * turn.y, p.x * turn.y + p.y * turn.x);
  let q = vec3f(face, sqrt(max(1.0 - dot(face, face), 0.0)));
  return moonSurface(q);
}

// The moon's disc in direction d, which is drawn at this pixel of the target.
fn moonDisc(d: vec3f, pixel: vec2f) -> vec3f {
  let p = onDisc(d, scene.moon.xyz, MOON_RADIUS * vec2f(scene.moonlit.w, scene.clouded.w));
  let r = length(p);
  let blur = edgeIn(MOON_EDGE, d.y);
  let edge = (1.0 - smoothstep(1.0 - blur, 1.0 + blur, r)) * throughHaze(d.y);
  if (edge <= 0.0 || scene.moon.w <= 0.0) {
    return vec3f(0.0);
  }
  // Its surface as last drawn, where that covers this pixel, and worked out here where
  // it doesn't, as before it is first drawn: the same number either way.
  let at = vec2i(pixel) - vec2i(moonFacePart.pixels.xy);
  var surface: f32;
  if (all(at >= vec2i(0)) && all(at < vec2i(moonFacePart.pixels.zw))) {
    surface = textureLoad(moonFace, at, 0).r;
  } else {
    surface = moonSeen(moonAt(pixel));
  }
  // Far more of its disc shows through rain cloud than of its light on the ground, as it
  // shows through the thin of the deck, and the eye finds it there.
  return MOON_SURFACE * surface * edge * scene.moon.w * throughAir(d.y * MOON_HEIGHT) * mix(1.0, MOON_THROUGH_RAIN, scene.wind.w);
}

// How much the folds of rain cloud light or shade the sky in direction d, the same size
// through a long lens or a wide one. They flatten out towards the horizon, where the
// ocean's haze has to meet the sky without a line.
fn cloudFolds(d: vec3f) -> f32 {
  let rain = scene.wind.w;
  if (rain <= 0.0) {
    return 1.0;
  }
  let plane = d.xz / (max(d.y, 0.0) + 0.16) * scene.up.w * 0.55 + heavens.rainCloud.xy;
  // Two sizes of fold, spread as far about their middle as four were: the two finer ones
  // were a fifth of the shape, lost in cloud as soft as this, and half of what every
  // pixel of a rainy sky cost.
  let at = vec3f(plane, heavens.rainCloud.z);
  let shape = 0.095 + moonNoise(at) * 0.52 + moonNoise(at * 2.03) * 0.29;
  let fold = mix(CLOUD_FOLD_DARK, CLOUD_FOLD_BRIGHT, smoothstep(0.2, 0.75, shape));
  return mix(1.0, fold, rain * smoothstep(0.0, CLOUD_FOLDS_START, d.y));
}

// How much of the sky in direction d the discs of the sun and moon cover, 0–1: what
// lies beyond them, as the Milky Way does, is hidden there.
fn discCover(d: vec3f) -> f32 {
  let moon = 1.0 - smoothstep(1.0 - MOON_EDGE, 1.0 + MOON_EDGE, length(onDisc(d, scene.moon.xyz, MOON_RADIUS * vec2f(scene.moonlit.w, scene.clouded.w))));
  let sun = 1.0 - smoothstep(1.0 - SUN_EDGE, 1.0 + SUN_EDGE, length(onDisc(d, scene.sun.xyz, SUN_RADIUS * vec2f(scene.sunlit.w, scene.skylit.w))));
  return max(select(0.0, moon, scene.moon.w > 0.0), sun);
}

struct SkyOver {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  // How much of the sun's disc lies behind cloud: the same for every pixel.
  @location(1) @interpolate(flat) clouded: f32,
}

// overVertex, with how much of the sun's disc the clouds hide, read once for the whole sky.
@vertex
fn skyVertex(@builtin(vertex_index) index: u32) -> SkyOver {
  let corner = overCorner(index);
  let sun = discClouded(scene.sun.xyz, SUN_RADIUS * vec2f(scene.sunlit.w, scene.skylit.w));
  return SkyOver(corner.position, corner.uv, sun);
}

@fragment
fn skyFragment(over: SkyOver) -> @location(0) vec4f {
  let ndc = ndcOf(over.uv);
  let d = sceneWayAt(ndc);
  let cloud = cloudsSmoothly(over.uv);
  // The discs are cut off sharply by the cloud in front of them, and only thin cloud lets
  // either show through: what cloud lets by of a beam is less than what it lets by of
  // the sky. The glare is the camera's, of as much of the sun as it sees.
  let through = (1.0 - cloud.a) * (1.0 - cloud.a);
  var radiance = cloud.rgb + (moonDisc(d, over.position.xy) + sunDisc(d)) * through + sunGlare(d) * (1.0 - over.clouded);
  // The sky behind cloud thick enough to hide it all isn't worked out: the discs are
  // bright enough to show through even that.
  if (cloud.a < CLOUD_HIDES) {
    let behind = skyRadiance(d) * cloudFolds(d) + milkyWay(skyWay(ndc)) * cloudCover() * (1.0 - discCover(d));
    radiance += behind * (1.0 - cloud.a);
  }
  return vec4f(display(radiance, over.position.xy), 1.0);
}

// The moon's surface at each pixel of the part of the target its disc can reach, drawn
// over the whole of a texture that part fills, for moonDisc to read while the moon
// stays where it is.
@fragment
fn moonFaceFragment(over: Over) -> @location(0) vec4f {
  let p = moonAt(over.position.xy + moonFacePart.pixels.xy);
  // Past the furthest its edge is ever blurred out to, with a little to spare, it is never read.
  if (length(p) > 1.02 + MOON_EDGE + VEILED_EDGE) {
    return vec4f(0.0);
  }
  return vec4f(moonSeen(p), 0.0, 0.0, 1.0);
}
`
}
