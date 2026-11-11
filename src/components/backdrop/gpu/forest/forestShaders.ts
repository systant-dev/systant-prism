// WGSL for the forest as it runs, frame after frame: the wind, how its light is worked
// out, and how the panorama (panorama.ts) is lit and moved.
//
// Trees really are pushed about by the wind here. A trunk is a beam fixed at the
// ground (beam.ts), which moves in two shapes at once: a slow sway, stiffest at the
// foot and freest at the top, and a quicker one that whips the top against the rest. A
// limb is a shorter beam fixed to the trunk, and in a broadleaved tree it is limbs that do
// most of the moving: the trunk sways a little, and each great mass of leaves goes its
// own way upon it. All of them are stepped every frame by a compute shader, as damped
// oscillators: gusts of noise blow across the wood at the
// speed of the wind, and each pushes by the square of its speed against what it meets,
// which is drag, so that a tree moving with the wind feels less of it and one moving
// against it more, and that is what damps it. A branch is shaken by its trunk as well,
// so it lags behind every swing and carries on past the end of it. So crowns lean as a
// gust reaches them, their tops furthest, and swing back at their own natural
// frequency, long after it has passed. Inside a crown the wind falls away fast, as the
// leaves above take it, so that limbs at the top are thrown about while those below
// hardly stir.
//
// Each pixel of the panorama knows how far up its tree it is, and how far out along
// its limb, and moves by the shape of the trunk at that point, and with its limb, which
// carries its whole lobe, up and down as well as to and fro, and the tips of its twigs
// flexing on top of that. What can't be done
// is move neighbouring trees by one smooth bend of the picture, which would stretch all
// that lies between them. So a pixel belongs to its own tuft and lobe, and slides over
// what is behind it: it looks at what is around it, asks each lobe there whether it has
// moved here, and the nearest that has is what it shows. If none has, what was in front
// has moved off, and it shows what the panorama has behind that.
//
// Most of what is seen of wind from a distance isn't movement anyway. A leaf is too
// small and too fast to be worth a spring, but each pixel knows the leaf it shows, which
// turns on a clock of its own, so that the light falls on one leaf and then another.
// Each branch's clock runs by the wind on it, so that a gust sets its leaves fluttering
// faster, and it speeds up and slows down without a jump. As a gust reaches them they
// turn their paler sides up, a few and then more, so that gusts can be seen rolling
// across the wood. And the shadows of the leaves above move with them over those below.
//
// A frame costs a compute dispatch and one pass over the part of the screen that
// isn't sky, whatever is in view. All the leaves in the
// world can't make that any dearer, as they were paid for when the panorama was made.
// Shadows are worked out by marching towards the sun over the heights of the canopy,
// at low resolution, only when the sun has moved far enough to change them.
import { noiseSource, overSource, SKY_UNIFORM, skyFieldsSource, skyLightSource, SKY_UNIFORMS_SIZE } from '../sky'
import { firstShapeSource, SECOND_SHAPE_RATE, tipBendSource } from './beam'
import { heightsSource, PANORAMA_HEIGHT, PANORAMA_ROWS, PANORAMA_TOP, PANORAMA_WIDTH } from './panorama'
import { CROWN_BITS } from './stand'

/** How many bytes the scene's uniforms take. */
export const FOREST_UNIFORMS_SIZE = SKY_UNIFORMS_SIZE + 16 * 3

const FIRST_FIELD = SKY_UNIFORMS_SIZE / 4

/** Where each field of the scene's uniforms starts, in 32-bit floats. */
export const FOREST_UNIFORM = {
  ...SKY_UNIFORM,
  lamp: FIRST_FIELD,
  delta: FIRST_FIELD + 3,
  view: FIRST_FIELD + 4,
  lampSeen: FIRST_FIELD + 8,
} as const

/**
 * The length of the scene's clock, in seconds, after which it wraps. Each leaf turns
 * a whole number of times in it, so they all go on as if it hadn't, and the springs
 * smooth over the jump in the gusts.
 */
export const LOOP_SECONDS = 1024

/** How many bytes the lights take on the GPU. */
export const LIGHTS_SIZE = 16 * 4

/**
 * How many pixels of the panorama a metre of sway moves a part: the same at any
 * distance, as a metre at the back would otherwise be a quarter of the pixels it is at
 * the front, and those trees would seem not to move at all.
 */
const SWAY_PIXELS = 15

/** How many a shader handles at once. */
export const WIND_GROUP = 16

export const forestSource = /* wgsl */ `
struct Scene {
${skyFieldsSource}
  // The way to what lights the forest now, then how long the last frame was, in seconds.
  lamp: vec4f,
  // How much of the panorama the view shows, across and down, and the mip to read it at.
  view: vec4f,
  // The way to the lamp, in the axes of the view: right, up and back towards the eye.
  lampSeen: vec4f,
}

struct Lights {
  // What falls on the leaves from the lamp, then how far into the night it is, 0–1,
  // and from the sky above and around them.
  direct: vec4f,
  above: vec4f,
  around: vec4f,
  // The colour of the air, towards the hill.
  air: vec4f,
}

@group(0) @binding(0) var<uniform> scene: Scene;

${skyLightSource}

// Where a place is in the panorama, 0–1 from its top left.
fn inPanorama(world: vec3f, halfWide: f32, halfHigh: f32) -> vec2f {
  let eye = world - scene.eyeTime.xyz;
  let depth = dot(eye, scene.forward.xyz);
  let across = dot(eye, scene.right.xyz) / depth / halfWide;
  let down = dot(eye, scene.up.xyz) / depth / halfHigh;
  return vec2f(across, -down) * 0.5 + 0.5;
}
`

/** Works out the colour of the light, every second or so. */
export const lightSource = /* wgsl */ `
// The ocean has its glints to show the moon by, and a wood has only this.
const MOON_LIFT = 3.0;
// How much of the moon's light comes from above and around once the leaves and the
// air have thrown it about: a moonlit wood is not black between its crowns.
const MOON_ABOVE = 0.14;
const MOON_AROUND = 0.07;
// How much of it there is while the moon is low, and how high its disc is by the time
// it is all there: a low moon's light strikes the wood at a slant.
const MOON_LOW = 0.3;
const MOON_CLIMBED = 0.11;
// How much of it gets through rain cloud, spread out: a wood has only this to be seen by.
const MOON_THROUGH_RAIN = 0.15;
// Leaves are lit as under thin high cloud by day, whatever the sky shows, as nothing
// else gives them the soft, pale light they look real in. This is how much of the
// daylight it spreads out, 0–1, its colour, and how much of the light it sends on
// down. By night there is none, so the moon's shadows are sharp.
const VEIL = 0.78;
const CLOUD_SHEET = vec3f(0.88, 0.87, 1.1);
const CLOUD_RADIANCE = 0.092;

// The light from a sheet of cloud overhead, lit by the sun above it.
fn cloudLight(way: vec3f) -> vec3f {
  let sunward = saturate(dot(way, scene.sun.xyz));
  return (skylight() * 0.5 + sunlight() * 0.5) * CLOUD_SHEET * CLOUD_RADIANCE * (1.0 + 0.6 * sunward);
}

@group(0) @binding(1) var<storage, read_write> lights: Lights;

@compute @workgroup_size(1)
fn lightMain() {
  let sunUp = smoothstep(-0.01, 0.05, scene.sun.w);
  let night = scene.moon.w;
  // Rain cloud is a sheet of its own, which is all in the sky by now.
  let veil = VEIL * (1.0 - night) * (1.0 - scene.wind.w);
  // A thin sheet of cloud takes the shadows from the sun, and gives it all to the sky.
  let sun = sunlight() * sunUp * (1.0 - 0.62 * veil);
  // By the height it really has, not the height of its disc, which stays low.
  let climbed = mix(MOON_LOW, 1.0, saturate(scene.moon.y / MOON_CLIMBED));
  let moon = MOONLIGHT * night * throughAir(scene.lamp.y * MOON_HEIGHT) * MOON_LIFT * climbed * mix(1.0, MOON_THROUGH_RAIN, scene.wind.w);
  lights.direct = vec4f(sun + moon * (1.0 - sunUp), night);
  let up = vec3f(0.0, 1.0, 0.0);
  let side = normalize(vec3f(scene.lamp.x, 0.16, scene.lamp.z));
  let overhead = mix(skyRadiance(up), cloudLight(up) + NIGHT_ZENITH, veil);
  let beside = mix(skyRadiance(side), cloudLight(side) + NIGHT_HORIZON, veil);
  lights.above = vec4f(overhead * 3.05 + moon * MOON_ABOVE, 0.0);
  lights.around = vec4f(beside * 0.62 + overhead * 0.2 + moon * MOON_AROUND, 0.0);
  lights.air = vec4f(skyRadiance(normalize(vec3f(0.0, 0.03, 1.0))), 0.0);
}
`

/** How far the lamp reaches each pixel, at low resolution, when it has moved enough to matter. */
export function shadowSource(halfWide: number, halfHigh: number) {
  return /* wgsl */ `
const HALF_WIDE = ${halfWide};
const HALF_HIGH = ${halfHigh};
// How wide the penumbra is for each metre to what casts it, and the steps to take, in metres.
const PENUMBRA = 0.09;
const SUN_STEPS = 13;
const FIRST_STEP = 0.6;
const STEP_GROWTH = 1.38;
// How much is taken for the leaf itself, in metres, so that it doesn't shade itself.
const SKIN = 0.3;

@group(0) @binding(1) var heights: texture_2d<f32>;
@group(0) @binding(2) var depths: texture_2d<f32>;
@group(0) @binding(3) var albedos: texture_2d<f32>;
@group(0) @binding(4) var smooth_: sampler;

${overSource}
${heightsSource}

// By the closest any step comes to the canopy, for a shadow with a soft edge.
@fragment
fn shadowFragment(over: Over) -> @location(0) vec4f {
  // Of the panorama, only the rows from PANORAMA_TOP are kept, and there is only sky above them.
  let pixel = vec2i(over.uv * vec2f(${PANORAMA_WIDTH}.0, ${PANORAMA_HEIGHT}.0)) - vec2i(0, ${PANORAMA_TOP});
  if (pixel.y < 0) {
    return vec4f(1.0);
  }
  let cover = textureLoad(albedos, pixel, 0).a;
  if (cover < 0.05) {
    return vec4f(1.0);
  }
  let depth = textureLoad(depths, pixel, 0).r / cover;
  let ray = scene.forward.xyz
    + scene.right.xyz * (over.uv.x * 2.0 - 1.0) * HALF_WIDE
    + scene.up.xyz * (1.0 - over.uv.y * 2.0) * HALF_HIGH;
  let start = scene.eyeTime.xyz + ray * depth;
  let way = scene.lamp.xyz;
  var open = 1.0;
  var along = FIRST_STEP;
  for (var i = 0; i < SUN_STEPS; i++) {
    let p = start + way * along;
    open = min(open, saturate(0.5 + (p.y + SKIN - heightAt(p.xz)) / (along * PENUMBRA + 0.45)));
    along *= STEP_GROWTH;
  }
  return vec4f(open);
}
`
}

/** Pushes the trees about, once a frame. */
export const windSource = /* @__PURE__ */ windShader()

/** Made by a function, or a bundle without the forest would keep all that it is made from. */
function windShader() {
  return /* wgsl */ `
${noiseSource}
${firstShapeSource}

// How fast the gusts cross the wood, in m/s, and how wide they are, in metres.
const GUST_SPEED = 5.4;
const GUST_WIDE = 118.0;
const GUST_NARROW = 41.0;
// How much the wind's speed varies, as a share of its mean, and how a branch's does.
const GUSTINESS = 0.93;
const FLURRY = 1.5;
// How strong eddies are, as a share of the lean of a mean wind, and how fast they turn over.
const EDDIES = 2.5;
const EDDY_RATE = 0.505;
// How wide the eddies are that neighbours share, as waves to the metre, and how much of
// what shakes a tree is its own.
const EDDY_SIZE = 0.125;
const EDDY_ALONE = 0.75;
// How much of a gust goes into a lean, how long one can take to reach a crown, in seconds,
// and how far from the wind a lopsided crown can give, in radians.
const GUST_LEAN = 0.35;
const GUST_LAG = 1.8;
const LOPSIDED = 1.3;
// How far a trunk can lean, in metres: a stem stiffens as it bends, and its crown spills the wind.
const STIFFENS = 0.7;
const LIMB_STIFFENS = 1.7;
// How much of the sway the second shape gets, how quick the turbulence that drives it
// is, how much faster it goes than the first, and how well it is damped.
const WHIP = 0.3;
const WHIP_RATE = 0.9;
const SECOND_RATE = ${SECOND_SHAPE_RATE};
const WHIP_DAMPING = 0.2;
// How much of a tree's movement is left to its trunk, as limbs take up most of the wind.
const TRUNK_SHARE = 0.42;
// How far a limb at the top leans for a mean wind, in metres, and how well it is damped.
const BRANCH_SWAY = 0.44;
const BRANCH_DAMPING = 0.188;
// How fast the wind falls away going down into a crown: to the power of the share of
// its tree left above, as it does through any canopy.
const CANOPY_DECAY = 2.6;
// How fast the eddies are that shake a limb, which are no wider than one.
const LIMB_RATE = 0.555;
const LIMB_SIDE_RATE = 0.759;
// How fast a branch's leaves flutter in still air, and how much faster for a mean wind.
const FLUTTER_CALM = 0.45;
const FLUTTER_GUST = 0.6;

struct Tree {
  at: vec2f,
  // Its natural frequency in Hz, and the share of critical damping it has.
  frequency: f32,
  damping: f32,
  // How far its top leans for a mean wind, in metres.
  sway: f32,
  first: u32,
  count: u32,
  // A number of its own, 0–1, for all that is its own and no other tree's.
  own: f32,
}

struct Branch {
  at: vec2f,
  frequency: f32,
  // How far up its tree it grows, 0–1.
  up: f32,
}

@group(0) @binding(1) var<storage, read> trees: array<Tree>;
@group(0) @binding(2) var<storage, read> branches: array<Branch>;
// Where each is and how fast it is going, in the plane: a tree's two shapes, in turn.
@group(0) @binding(3) var<storage, read_write> treeState: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> branchState: array<vec4f>;
// Two for each branch: how far its tree's top has gone in each shape, in metres, then
// how far the branch has gone from that, how hard the wind is on it, and its leaves' clock.
@group(0) @binding(5) var<storage, read_write> motion: array<vec4f>;

// The wind's speed at a place, as a share of its mean, by two sizes of gust carried
// along with it, changing shape slowly as they go.
fn gust(place: vec2f, time: f32) -> f32 {
  let carried = place - scene.wind.xy * GUST_SPEED * time;
  let wide = moonNoise(vec3f(carried / GUST_WIDE, time * 0.05));
  let narrow = moonNoise(vec3f(carried.yx / GUST_NARROW + 19.0, time * 0.13));
  let shaped = smoothstep(0.3, 0.74, wide * 0.68 + narrow * 0.32);
  return 0.5 + GUSTINESS * shaped;
}

// One step of a spring, whose force is drag on it: leaned over by the square of the
// wind, in the direction it is blowing. x is where it is and how fast it is going,
// and it is semi-implicit, so that no step this size can set it ringing.
fn stepped(state: vec4f, push: vec2f, omega: f32, damping: f32, delta: f32) -> vec4f {
  let force = omega * omega * (push - state.xy) - 2.0 * damping * omega * state.zw;
  let velocity = state.zw + force * delta;
  return vec4f(state.xy + velocity * delta, velocity);
}

@compute @workgroup_size(${WIND_GROUP})
fn windMain(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= arrayLength(&trees)) {
    return;
  }
  let tree = trees[id.x];
  let time = scene.eyeTime.w;
  let delta = scene.lamp.w;
  let blowing = scene.wind.xy;
  let across = vec2f(-blowing.y, blowing.x);

  // A gust reaches a crown when it finds a way down to it, not all at once.
  let speed = gust(tree.at, time - tree.own * GUST_LAG);
  // A tree only moves as the wind changes, and a steady lean is no movement at all, so
  // it is eddies that keep it rocking, from side to side and to and fro, gust or no gust.
  // Those that shake a tree at the rate it sways are smaller than the gap to the next
  // one, as turbulence over a wood is no wider than a crown, so most of this is its own.
  let rate = time * EDDY_RATE * (0.8 + 0.5 * tree.own);
  let together = vec2f(
    moonNoise(vec3f(tree.at * EDDY_SIZE + 3.0, rate)),
    moonNoise(vec3f(tree.at.yx * EDDY_SIZE + 9.0, rate * 1.3))
  ) - 0.5;
  let alone = vec2f(
    moonNoise(vec3f(tree.own * 911.0, tree.own * 373.0, rate)),
    moonNoise(vec3f(tree.own * 557.0, tree.own * 709.0, rate * 1.3))
  ) - 0.5;
  let eddy = mix(together, alone, EDDY_ALONE);
  let before = treeState[2u * id.x];
  // Drag goes by the wind the crown meets, which is the wind less its own movement, as
  // a share of a mean wind. That is all the damping a tree in the wind really needs.
  // A gust leans it a little, and shakes it far more: what comes down into a wood is
  // turbulence, not one even shove, or every tree under it would go the same way at once.
  let leaning = mix(1.0, speed, GUST_LEAN);
  let met = blowing * leaning + (across * eddy.x + blowing * eddy.y) * EDDIES * speed - before.zw / GUST_SPEED;
  // Only what changes shows, so this is about the lean of a mean wind, not from upright.
  let pushed = (met * length(met) - blowing) * tree.sway * TRUNK_SHARE;
  // A crown is never even, so each tree gives to the wind along a way of its own.
  let turn = (tree.own - 0.5) * LOPSIDED;
  let free = vec2f(
    pushed.x * cos(turn) - pushed.y * sin(turn),
    pushed.x * sin(turn) + pushed.y * cos(turn)
  );
  let lean = free / (1.0 + length(free) / STIFFENS);
  let omega = 2.0 * PI * tree.frequency;
  let top = stepped(before, lean, omega, tree.damping, delta);
  treeState[2u * id.x] = top;

  // Quicker turbulence sets off the second shape, which has little to do with the mean wind.
  let flurry = vec2f(
    moonNoise(vec3f(tree.own * 311.0, tree.own * 601.0, time * WHIP_RATE)),
    moonNoise(vec3f(tree.own * 433.0, tree.own * 257.0, time * WHIP_RATE * 1.27))
  ) - 0.5;
  let whipping = (across * flurry.x + blowing * flurry.y) * speed * WHIP * tree.sway;
  let whip = stepped(treeState[2u * id.x + 1u], whipping, omega * SECOND_RATE, WHIP_DAMPING, delta);
  treeState[2u * id.x + 1u] = whip;

  // How the trunk is shaking whatever grows from it.
  let shaking = (top.zw - before.zw) / max(delta, 0.001);

  for (var i = tree.first; i < tree.first + tree.count; i++) {
    let branch = branches[i];
    // Each by itself, as nothing inside a crown is wider than a limb.
    let own = moonHash(vec3f(floor(branch.at * 8.0), floor(branch.up * 255.0)));
    let local = moonNoise(vec3f(own * 911.0, own * 373.0, time * LIMB_RATE * (0.8 + 0.5 * own)));
    let shaken = leaning * (0.3 + FLURRY * local);
    let side = moonNoise(vec3f(own * 557.0, own * 709.0, time * LIMB_SIDE_RATE * (0.8 + 0.5 * own))) - 0.5;
    let reached = exp(-CANOPY_DECAY * (1.0 - branch.up));
    let branchOmega = 2.0 * PI * branch.frequency;
    // Seen from the trunk, a branch is thrown the other way each time the trunk moves off,
    // which is why it trails behind a swing and runs on past the end of it.
    let thrown = shaking * firstShape(branch.up) / (branchOmega * branchOmega);
    let force = (blowing * (shaken * shaken - 0.6) * speed + across * side * 1.8 * speed) * BRANCH_SWAY * reached - thrown;
    let push = force / (1.0 + length(force) / LIMB_STIFFENS);
    let state = stepped(branchState[i], push, branchOmega, BRANCH_DAMPING, delta);
    branchState[i] = state;
    let hard = speed * (0.4 + 0.9 * local);
    // It wraps with the scene's clock, as each leaf turns a whole number of times in that.
    let clock = (motion[2u * i + 1u].w + delta * (FLUTTER_CALM + FLUTTER_GUST * hard)) % ${LOOP_SECONDS}.0;
    motion[2u * i] = vec4f(top.xy, whip.xy);
    motion[2u * i + 1u] = vec4f(state.xy, hard, clock);
  }
}
`
}

/** Moves the parts of the panorama, and lights them over the sky. */
export const viewSource = /* @__PURE__ */ viewShader()

/** Made by a function, or a bundle without the forest would keep all that it is made from. */
function viewShader() {
  return /* wgsl */ `
${tipBendSource}
${overSource}

// How far a metre of sway moves a part across the panorama.
const SWAY = vec2f(${SWAY_PIXELS / PANORAMA_WIDTH}, ${SWAY_PIXELS / PANORAMA_HEIGHT});
// How far off the air starts to show, and how much of it there is to the metre after
// that: nothing near at hand, so that the shade stays deep, and more towards the hill.
const AIR_FROM = 130.0;
const AIR_DISTANCE = 2200.0;
// How long a turn of the clock is, and the turns a leaf makes in the time it runs for.
const TURN = 2.0 * PI / ${LOOP_SECONDS}.0;
const FLUTTER_SLOWEST = 458.0;
const FLUTTER_RANGE = 1355.0;
// How far the wind turns the leaves.
const LEAF_TURN = 0.328;
// How much paler leaves are as a gust turns them over: the most that can turn, and
// the colour of a leaf's underside.
const GUST_TURNS = 0.55;
const UNDERSIDE = vec3f(0.11, 0.13, 0.09);
// How much further than the leaf a shadow on it has moved, as what casts it is further up.
const SHADOW_SWAY = 1.2;
// How far a tuft nods by itself, across the panorama, and how often: from 0.6 to 1.3 Hz.
const TUFT_NOD = vec2f(${0.475 / PANORAMA_WIDTH}, ${0.305 / PANORAMA_HEIGHT});
const TUFT_SLOWEST = 627.0;
const TUFT_RANGE = 727.0;
// How much of a limb's movement is its whole lobe's: what is left of it is in its twigs,
// which go by how far out along them a leaf is.
const LIMB_CARRIES = 0.75;
// How much of a limb's movement across the wind shows as it bobbing up and down, as a
// limb bends far more easily that way than a trunk seen from above can show.
const LIMB_BOB = 0.8;
// How far a part can have moved to, looking from a pixel.
const REACH = vec2f(${11 / PANORAMA_WIDTH}, ${11 / PANORAMA_HEIGHT});
// Which bits of a part say which tuft it is, however far up and out it is.
const WHICH = 0xFFFFFu;
// How near the ground and the sky are, as if they were the furthest of the trees.
const GROUND_RANK = 0xFFFFFFFEu;
const SKY_RANK = 0xFFFFFFFFu;
// How many bits of a rank say which of a tree's lobes is nearest: the rest are its tree.
const CROWN_BITS = ${CROWN_BITS}u;
// What a pixel shows: the panorama, what it has behind that, or nothing but the sky.
const SHOW_FRONT = 0u;
const SHOW_BEHIND = 1u;
const SHOW_SKY = 2u;
// How much a part's leaves tilt as it bends, for each metre it has gone.
const BEND_TILT = 0.08;
// How much more of the sun comes through a leaf, of each colour.
const THROUGH = vec3f(1.2, 1.3, 0.6);
// How much of the lamp reaches even a shaded leaf, spread by the cloud and the leaves,
// and by the leaves alone, under a clear night sky.
const THROUGH_CLOUD = 0.42;
const THROUGH_CLEAR = 0.07;
// What the eye's rods make of each colour. By moonlight they do most of the seeing,
// and they see no colour, so green leaves go a blue-grey.
const RODS = vec3f(0.05, 0.62, 0.33);
// How much of a leaf's colour goes by the full of the moon: the cones still see a little.
const NIGHT_GREY = 0.72;
// The shine of a waxy leaf head on: this, more than anything, is why leaves under a
// white sky are pale and grey rather than the green they really are.
const SHINE = 0.011;
// What rain does: wet leaves are darker and shine far more, and the air thickens,
// taking the far side of the valley with it.
const WET_DARK = 0.72;
const WET_SHINE = 2.0;
const RAIN_AIR = 0.3;

@group(0) @binding(1) var<storage, read> lights: Lights;
@group(0) @binding(2) var albedos: texture_2d<f32>;
@group(0) @binding(3) var surfaces: texture_2d<f32>;
@group(0) @binding(4) var depths: texture_2d<f32>;
@group(0) @binding(5) var shadows: texture_2d<f32>;
@group(0) @binding(6) var parts: texture_2d<u32>;
@group(0) @binding(7) var<storage, read> motion: array<vec4f>;
@group(0) @binding(8) var smooth_: sampler;
@group(0) @binding(9) var behindAlbedos: texture_2d<f32>;
@group(0) @binding(10) var behindSurfaces: texture_2d<f32>;
@group(0) @binding(11) var behindParts: texture_2d<u32>;
@group(0) @binding(12) var<storage, read> owners: array<u32>;
// Both shapes of a trunk, at each height a part can be at.
@group(0) @binding(13) var<storage, read> shapes: array<vec2f>;

// Where a place in the panorama is in its textures, which leave out the sky at its top.
fn kept(uv: vec2f) -> vec2f {
  return vec2f(uv.x, (uv.y * ${PANORAMA_HEIGHT}.0 - ${PANORAMA_TOP}.0) / ${PANORAMA_ROWS}.0);
}

// Which part of the forest is here.
fn partAt(uv: vec2f) -> u32 {
  let pixel = vec2i(uv * vec2f(${PANORAMA_WIDTH}.0, ${PANORAMA_HEIGHT}.0)) - vec2i(0, ${PANORAMA_TOP});
  return textureLoad(parts, clamp(pixel, vec2i(0), vec2i(${PANORAMA_WIDTH - 1}, ${PANORAMA_ROWS - 1})), 0).r;
}

fn behindAt(uv: vec2f) -> u32 {
  let pixel = vec2i(uv * vec2f(${PANORAMA_WIDTH / 2}.0, ${PANORAMA_HEIGHT / 2}.0)) - vec2i(0, ${PANORAMA_TOP / 2});
  return textureLoad(behindParts, clamp(pixel, vec2i(0), vec2i(${PANORAMA_WIDTH / 2 - 1}, ${PANORAMA_ROWS / 2 - 1})), 0).r;
}

// Which lobe of which tree a part is of, in order from the eye: of two, the smaller is
// in front, and all but its lowest bits say which tree.
fn rankOf(part: u32) -> u32 {
  let lobe = (part >> 4u) & 0xFFFFu;
  if (lobe == 0u) {
    return select(SKY_RANK, GROUND_RANK, part == 1u);
  }
  return owners[lobe - 1u];
}

// How far a part has been carried across the panorama by its trunk and limb.
fn carried(part: u32) -> vec2f {
  let lobe = (part >> 4u) & 0xFFFFu;
  if (lobe == 0u) {
    return vec2f(0.0);
  }
  let tree = motion[2u * (lobe - 1u)];
  let branch = motion[2u * (lobe - 1u) + 1u];
  let shape = shapes[part >> 24u];
  let out = f32((part >> 20u) & 15u) / 15.0;
  // The trunk's two shapes where this is on it, and its limb, out to where this is on that.
  let trunk = tree.xy * shape.x + tree.zw * shape.y;
  let limb = branch.xy * (LIMB_CARRIES + (1.0 - LIMB_CARRIES) * tipBend(out));
  // Leaning towards the eye or away shows as a nod, and what leans comes down a little.
  return vec2f(trunk.x + limb.x, trunk.y * 0.3 + limb.y * LIMB_BOB + dot(trunk, trunk) * 0.06) * SWAY;
}

// All of how far a part has moved, with the nod of its own tuft, how hard the wind is on
// it, and how far its leaves' clock has got.
fn movement(part: u32) -> vec4f {
  let lobe = (part >> 4u) & 0xFFFFu;
  if (lobe == 0u) {
    return vec4f(0.0);
  }
  let branch = motion[2u * (lobe - 1u) + 1u];
  let out = f32((part >> 20u) & 15u) / 15.0;
  let own = fract(f32(part & WHICH) * 0.6180339887);
  let turns = floor(TUFT_SLOWEST + own * TUFT_RANGE);
  let beat = scene.eyeTime.w * turns * TURN + own * 53.0;
  let nod = vec2f(sin(beat), cos(beat * 0.7 + own * 9.0)) * TUFT_NOD * branch.z * out * out;
  return vec4f(carried(part) + nod, branch.zw);
}

struct Arrival {
  part: u32,
  shows: u32,
}

// What has moved to here, which is what the pixel shows. Each lobe moves as one, so
// that nothing can stretch, and whichever is nearest and has reached here hides the
// rest. The nearest can only be asked once, however many of it there are around here,
// so that it costs next to nothing in the middle of a lobe.
fn arrival(here: vec2f) -> Arrival {
  var nearest = SKY_RANK;
  var came = 0u;
  // Where lobes of a crown have parted, what fills the gap is the rest of that crown.
  var nearestCrown = SKY_RANK;
  var filled = 0u;
  for (var i = 0u; i < 5u; i++) {
    let corner = i - 1u;
    let side = select(vec2f(f32(corner & 1u) * 2.0 - 1.0, f32(corner >> 1u) * 2.0 - 1.0), vec2f(0.0), i == 0u);
    let part = partAt(here + side * REACH);
    let rank = rankOf(part);
    if (rank >= nearest) {
      continue;
    }
    let source = partAt(here - carried(part));
    let found = rankOf(source);
    if (found == rank) {
      nearest = rank;
      came = source;
    } else if (found >> CROWN_BITS == rank >> CROWN_BITS && rank < nearestCrown) {
      nearestCrown = rank;
      filled = part;
    }
  }
  if ((nearestCrown >> CROWN_BITS) < (nearest >> CROWN_BITS)) {
    return Arrival(filled, SHOW_FRONT);
  }
  if (nearest != SKY_RANK) {
    return Arrival(came, SHOW_FRONT);
  }
  // Nothing has come here. The edge of a tree's own pixels hold what is left of the sky.
  if (partAt(here) == 0u) {
    return Arrival(0u, SHOW_FRONT);
  }
  // What was in front has gone, and uncovers what it stood before, which has moved too.
  let under = behindAt(here);
  if (under == 0u) {
    return Arrival(0u, SHOW_SKY);
  }
  let crown = rankOf(under) >> CROWN_BITS;
  let moved = carried(under);
  let source = partAt(here - moved);
  if (rankOf(source) >> CROWN_BITS == crown) {
    return Arrival(source, SHOW_FRONT);
  }
  let below = behindAt(here - moved);
  return Arrival(select(under, below, rankOf(below) >> CROWN_BITS == crown), SHOW_BEHIND);
}

@fragment
fn viewFragment(screen: Over) -> @location(0) vec4f {
  let centred = 0.5 + (screen.uv - 0.5) * scene.view.xy;
  let arrived = arrival(centred);
  if (arrived.shows == SHOW_SKY) {
    discard;
  }
  let wind = movement(arrived.part);
  let at = centred - wind.xy;
  let keptAt = kept(at);
  let behind = arrived.shows == SHOW_BEHIND;

  let lod = scene.view.z;
  var colour: vec4f;
  var surface: vec4f;
  if (behind) {
    colour = textureSampleLevel(behindAlbedos, smooth_, keptAt, 0.0);
    surface = textureSampleLevel(behindSurfaces, smooth_, keptAt, 0.0);
  } else {
    colour = textureSampleLevel(albedos, smooth_, keptAt, lod);
    surface = textureSampleLevel(surfaces, smooth_, keptAt, lod);
  }
  if (colour.a < 0.004) {
    discard;
  }
  let cover = colour.a;
  surface /= cover;
  // What is uncovered is in the shade of the place it is seen in, and much of a depth with it.
  var shade = surface.b;
  var measuredAt = keptAt;
  var measuredCover = cover;
  if (behind) {
    measuredAt = kept(centred);
    measuredCover = max(textureSampleLevel(albedos, smooth_, measuredAt, 0.0).a, 0.01);
    shade = min(shade, textureSampleLevel(surfaces, smooth_, measuredAt, 0.0).b / measuredCover);
  }
  let night = lights.direct.a;
  let daylit = colour.rgb * colour.rgb / (cover * cover);
  let rain = scene.wind.w;
  let phase = surface.a;

  let turns = floor(FLUTTER_SLOWEST + phase * FLUTTER_RANGE);
  let beat = sin(wind.w * turns * TURN + phase * 91.0);
  let turning = beat * wind.z;
  // The wind has to be up before it turns a leaf over, and some turn sooner than others.
  let gust = saturate((wind.z - 0.75) / 1.1);
  let over = saturate((gust + phase * 0.8 - 0.9) * 5.0) * (0.5 + 0.5 * beat) * GUST_TURNS;
  let turned = mix(daylit, UNDERSIDE, over);
  let albedo = mix(turned, vec3f(dot(turned, RODS)), night * NIGHT_GREY) * mix(1.0, WET_DARK, rain);
  // What bends turns as it goes, so that a top leaning over takes the light differently.
  let leaning = wind.xy / SWAY * BEND_TILT;
  let tilt = surface.xy * 2.0 - 1.0 + scene.wind.xy * turning * LEAF_TURN + leaning;
  let facing = sqrt(max(1.0 - dot(tilt, tilt), 0.02));
  let n = vec3f(tilt, facing);

  let lit = dot(n, scene.lampSeen.xyz);
  let open = textureSampleLevel(shadows, smooth_, at - wind.xy * SHADOW_SWAY, 0.0).r;
  let through = mix(THROUGH_CLOUD, THROUGH_CLEAR, night);
  let sun = lights.direct.rgb * mix(through, 1.0, open) * (0.25 + 0.75 * shade) / PI;
  let sky = mix(lights.around.rgb, lights.above.rgb, saturate(n.y * 0.6 + 0.4)) * shade;
  // A broad sheen, not a glint: the sky it reflects is the same everywhere.
  let shine = lights.above.rgb * (SHINE + 0.12 * pow(1.0 - facing, 3.0)) * shade * mix(1.0, WET_SHINE, rain);

  let leaf = albedo * (sky + sun * saturate(lit) + sun * THROUGH * saturate(-lit) * 0.7) + shine * (1.0 + 2.0 * gust);
  let depth = textureSampleLevel(depths, smooth_, measuredAt, 0.0).r / measuredCover;
  let air = 1.0 - exp(-max(depth - AIR_FROM, 0.0) / (AIR_DISTANCE * mix(1.0, RAIN_AIR, rain)));
  let radiance = leaf * (1.0 - air) + lights.air.rgb * air;
  return vec4f(display(radiance, screen.position.xy) * cover, cover);
}
`
}
