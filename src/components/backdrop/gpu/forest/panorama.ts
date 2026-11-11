// The forest, drawn once. As the camera never moves, nothing can be seen from it that
// can't be drawn in advance, so all that it costs to draw every leaf of every tree
// is one long moment when the scene is made, and what is kept isn't a picture but
// what's needed to light one: the colour of what's in each pixel, the way it faces,
// how much of the sky it sees and how far away it is. Each frame only has to light
// that, for the time of day, which is how a screen's worth of a few million real
// leaves can cost less than an ocean.
//
// Each leaf is a real one, a small diamond in space facing its own way, which a
// shader works out from its number alone. They lie in tufts on their lobes, or hang
// in strands from them, and the depth test sorts them all out. It's done in tiles
// with four samples to a pixel: too much for a device to hold for the whole panorama at
// once, and a chance for the page to breathe between them.
//
// Trees have skeletons too: a trunk, a limb to each lobe and a twig to each tuft, which
// show dark through the gaps in the leaves and are much of why a crown doesn't look
// like moss.
//
// Light is what gives a wood its shape, so the same leaves are drawn again from straight
// above, into a map of how high the forest is at every half metre. Each pixel of the
// panorama then looks out across that map, all round, for how much of the sky the trees
// around it leave open. That is what takes the valleys between crowns properly dark
// and leaves their tops in the light, and shadows are cast over the same map as the sun
// moves. Last, each pixel is darkened by what stands closest around it on the screen.
//
// A tree that sways uncovers what was behind it, which a single picture doesn't have, so
// there is a second, smaller one of what each pixel would show if the tree in front of
// it weren't there: everything is drawn once more, leaving out the leaves of whichever
// tree is at that pixel. It is seen in slivers, in that tree's shade, so it can be plain.
import { createMipPipeline, hashSource, interleavedSource, keeper, type Kept, mipChain, overSource } from '../sky'
import { forestCamera, panoramaCamera, SKY_ONLY, WIDEST_ASPECT } from './camera'
import {
  blocksInStrip,
  CROWN_BITS,
  FIELD_CELL,
  FIELD_COLUMNS,
  FIELD_LEFT,
  FIELD_ROWS,
  HULL_STRIDE,
  LEAF_BLOCK,
  type Stand,
} from './stand'

/** The size of the panorama: 1440p's height, to be sharp at a scene's largest, and all the width any view can be. */
export const PANORAMA_HEIGHT = 1440
export const PANORAMA_WIDTH = Math.round(PANORAMA_HEIGHT * WIDEST_ASPECT)

/** How many mips it has, for views smaller than that. */
export const PANORAMA_MIPS = 5

/**
 * The first row that is kept, and how many are. Above it is only sky, which is nothing
 * to keep, and which no view looks at for trees. On a whole number of the smallest mip's
 * pixels, so that every mip is what it would be if those rows were there.
 */
export const PANORAMA_TOP =
  Math.floor((SKY_ONLY * PANORAMA_HEIGHT) / 2 ** (PANORAMA_MIPS - 1)) * 2 ** (PANORAMA_MIPS - 1)
export const PANORAMA_ROWS = PANORAMA_HEIGHT - PANORAMA_TOP

/** How many tiles it is drawn in, across, and how wide each is. */
const TILES = 6
const TILE_WIDTH = Math.ceil(PANORAMA_WIDTH / TILES)

/** How many samples each pixel has while it is drawn. */
const SAMPLES = 4

/** How many values the uniforms of a tile have. */
const TILE_UNIFORMS = 20

/** How many cells of the map of heights there are to a cell of the land, and so its size. */
const HEIGHTS_PER_CELL = 4
const HEIGHTS_WIDTH = FIELD_COLUMNS * HEIGHTS_PER_CELL
const HEIGHTS_DEPTH = FIELD_ROWS * HEIGHTS_PER_CELL

/** The lowest and highest anything can be, in metres, which the map's depth runs between. */
const LOWEST = -30
const HIGHEST = 110

/** The twigs and limbs of a lobe, as a shader counts them: one limb, one trunk and a twig to each tuft. */
const TUFTS = 14
const WOOD_PER_LOBE = TUFTS + 2

const SURFACE_FORMAT: GPUTextureFormat = 'rgba8unorm'
const DEPTH_FORMAT: GPUTextureFormat = 'r16float'
const PART_FORMAT: GPUTextureFormat = 'r32uint'
const BEHIND_FORMATS = [SURFACE_FORMAT, SURFACE_FORMAT, PART_FORMAT]

export interface Panorama {
  /** The square root of the albedo, by coverage: alpha is what of the pixel is forest. */
  albedos: GPUTexture
  /** The way each pixel faces, how much of the sky it sees and which leaf it is, by coverage. */
  surfaces: GPUTexture
  /** How far away each pixel is, by coverage, along the view. */
  depths: GPUTexture
  /** How high the forest is, seen from straight above, by the half metre. */
  heights: GPUTexture
  /**
   * Which part of the forest is at each pixel, as a number that can't be averaged: 0
   * for sky, 1 for the ground, or the tuft in its lowest 4 bits, the lobe, counted from
   * 1, in the next 16, then how far out along its branch it is in 4 and how far up its
   * tree in the top 8, for the wind to bend it by.
   */
  parts: GPUTexture
  /** What is behind the tree at each pixel, at half the size, in the same terms as the three above. */
  behindAlbedos: GPUTexture
  behindSurfaces: GPUTexture
  behindParts: GPUTexture
  /**
   * The row of the whole panorama, from its top, below which there is no gap in the
   * forest or behind any of its trees: below it no sky can show, however the trees sway.
   */
  openTo: number
}

/** The panorama as drawn, before its gaps are measured. */
type Drawn = Omit<Panorama, 'openTo'>

/** Finds the lowest kept row with a gap in it, front or behind, counted from 1; 0 for none. */
const gapSource = /* wgsl */ `
@group(0) @binding(0) var albedos: texture_2d<f32>;
@group(0) @binding(1) var parts: texture_2d<u32>;
@group(0) @binding(2) var behindAlbedos: texture_2d<f32>;
@group(0) @binding(3) var behindParts: texture_2d<u32>;
@group(0) @binding(4) var<storage, read_write> lowest: atomic<u32>;

@compute @workgroup_size(8, 8)
fn gapMain(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(albedos);
  if (id.x >= size.x || id.y >= size.y) {
    return;
  }
  let here = vec2i(id.xy);
  let behind = here / 2;
  let open = textureLoad(albedos, here, 0).a < 1.0 || textureLoad(parts, here, 0).r == 0u
    || textureLoad(behindAlbedos, behind, 0).a < 1.0 || textureLoad(behindParts, behind, 0).r == 0u;
  if (open) {
    atomicMax(&lowest, id.y + 1u);
  }
}
`

/** Where the panorama's lowest gap is (Panorama.openTo), read back from the GPU. */
async function lowestGap(device: GPUDevice, panorama: Drawn) {
  const pipeline = await device.createComputePipelineAsync({
    label: 'forest gaps',
    layout: 'auto',
    compute: { module: device.createShaderModule({ code: gapSource }), entryPoint: 'gapMain' },
  })
  const found = device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC })
  const read = device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST })
  try {
    const encoder = device.createCommandEncoder({ label: 'forest gaps' })
    const pass = encoder.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(
      0,
      device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: panorama.albedos.createView({ baseMipLevel: 0, mipLevelCount: 1 }) },
          { binding: 1, resource: panorama.parts.createView() },
          { binding: 2, resource: panorama.behindAlbedos.createView() },
          { binding: 3, resource: panorama.behindParts.createView() },
          { binding: 4, resource: { buffer: found } },
        ],
      }),
    )
    pass.dispatchWorkgroups(Math.ceil(PANORAMA_WIDTH / 8), Math.ceil(PANORAMA_ROWS / 8))
    pass.end()
    encoder.copyBufferToBuffer(found, 0, read, 0, 4)
    device.queue.submit([encoder.finish()])
    await read.mapAsync(GPUMapMode.READ)
    return PANORAMA_TOP + new Uint32Array(read.getMappedRange())[0]
  } finally {
    found.destroy()
    read.destroy()
  }
}

/** The map of heights, as looked up in by anything that goes by it. */
export const heightsSource = /* wgsl */ `
const FIELD = vec4f(${FIELD_LEFT}.0, 0.0, ${-2 * FIELD_LEFT}.0, ${FIELD_ROWS * FIELD_CELL}.0);

fn heightAt(place: vec2f) -> f32 {
  return textureSampleLevel(heights, smooth_, (place - FIELD.xy) / FIELD.zw, 0.0).r;
}
`

export const leafSource = /* wgsl */ `
const BLOCK = ${LEAF_BLOCK}u;
const TUFTS = ${TUFTS}u;
const STRANDS = 22u;
const WOOD_PER_LOBE = ${WOOD_PER_LOBE}u;
// The colour of a tuft's old leaves and of its new, as a share of its tree's.
const OLD_GROWTH = vec3f(0.88, 0.97, 1.0);
const NEW_GROWTH = vec3f(1.26, 1.24, 0.84);
// How far a branch reaches from the middle of its lobe, as a share of the lobe's size.
const BRANCH_REACH = 1.7;
// How much a leaf's bending goes by its own place, rather than its tuft's.
const LEAF_OWN = 0.3;
// How much of the sky is left to what is behind a tree, in that tree's shade.
const BEHIND_SHADE = 0.5;

struct Tile {
  right: vec4f,
  up: vec4f,
  forward: vec4f,
  eye: vec4f,
  // How much the tile is enlarged, and where its middle is, across, then whether this
  // is the map of heights, drawn from straight above.
  tile: vec4f,
}

struct Lobe {
  at: vec4f,
  // Its colour, then how far its leaves hang in strands.
  tint: vec4f,
  // How big its leaves are, how much sky it sees, how tall its tree is, and how high up
  // its crown it is.
  leaf: vec4f,
  // Where its tree stands, and how high its crown's middle is.
  tree: vec4f,
}

@group(0) @binding(0) var<uniform> view: Tile;
@group(0) @binding(1) var<storage, read> lobes: array<Lobe>;
@group(0) @binding(2) var<storage, read> blocks: array<u32>;
@group(1) @binding(0) var<storage, read> owners: array<u32>;
@group(1) @binding(1) var fronts: texture_2d<u32>;

${hashSource}

fn stir(state: ptr<function, u32>) -> f32 {
  let s = *state * 747796405u + 2891336453u;
  *state = s;
  return f32(permuted(s)) / 4294967295.0;
}

fn anyWay(state: ptr<function, u32>) -> vec3f {
  let y = stir(state) * 2.0 - 1.0;
  let turn = stir(state) * 6.2831853;
  let around = sqrt(max(1.0 - y * y, 0.0));
  return vec3f(cos(turn) * around, y, sin(turn) * around);
}

struct Leaf {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) albedo: vec3f,
  @location(1) @interpolate(flat) facing: vec2f,
  @location(2) @interpolate(flat) seen: f32,
  @location(3) @interpolate(flat) number: f32,
  @location(4) depth: f32,
  @location(5) @interpolate(flat) part: u32,
  // How far up its tree this is, and how far out along its branch, both 0–1.
  @location(6) up: f32,
  @location(7) out: f32,
}

fn clipped(world: vec3f) -> vec4f {
  if (view.tile.z > 0.5) {
    return vec4f(
      (world.x - ${FIELD_LEFT}.0) / ${-FIELD_LEFT}.0 - 1.0,
      1.0 - world.z / ${(FIELD_ROWS * FIELD_CELL) / 2}.0,
      (world.y - ${LOWEST}.0) / ${HIGHEST - LOWEST}.0,
      1.0
    );
  }
  let eye = world - view.eye.xyz;
  let depth = dot(eye, view.forward.xyz);
  return vec4f(
    (dot(eye, view.right.xyz) * view.right.w - view.tile.y * depth) * view.tile.x,
    dot(eye, view.up.xyz) * view.up.w,
    view.forward.w,
    depth
  );
}

// What is measured back from the eye, or up from the ground in the map of heights.
fn measured(world: vec3f, clip: vec4f) -> f32 {
  return select(clip.w, world.y, view.tile.z > 0.5);
}

struct Tuft {
  at: vec3f,
  way: vec3f,
  size: f32,
  // The colour of its growth, as a share of its tree's: new shoots are a yellower green.
  tint: vec3f,
  // Goes on from here for what grows from this tuft.
  state: u32,
}

// All that grows from a tuft finds it by its number. Those that face the eye are the
// ones that will be seen, so more of them lie on that side.
fn tuftOf(lobeNumber: u32, tuftNumber: u32, lobe: Lobe) -> Tuft {
  let toEye = normalize(view.eye.xyz - lobe.at.xyz);
  var tuft = lobeNumber * 2971u + tuftNumber * 613u + 11u;
  let way = normalize(anyWay(&tuft) + toEye * 0.75);
  let size = lobe.at.w * (0.5 + 0.3 * stir(&tuft));
  let age = stir(&tuft);
  let new_ = age * age;
  let tint = mix(OLD_GROWTH, NEW_GROWTH, new_) * (0.82 + 0.3 * stir(&tuft));
  return Tuft(lobe.at.xyz + way * lobe.at.w * 0.62, way, size, tint, tuft);
}

@vertex
fn leafVertex(@builtin(vertex_index) corner: u32, @builtin(instance_index) index: u32) -> Leaf {
  let lobeNumber = blocks[index / BLOCK];
  let lobe = lobes[lobeNumber];
  let size = lobe.at.w;

  var own = (index + 1u) * 2654435761u;
  stir(&own);

  let tuftNumber = u32(stir(&own) * f32(TUFTS));
  let grown = tuftOf(lobeNumber, tuftNumber, lobe);
  let tuft = grown.state;
  let tuftWay = grown.way;
  let tuftSize = grown.size;
  let tuftAt = grown.at;

  // A leaf grows on a spray: a twig that reaches out from the tuft and sags under its
  // own weight, by more the further out it gets. A birch's sags so far that it hangs.
  let droop = lobe.tint.w;
  var spray = tuft + u32(stir(&own) * f32(STRANDS)) * 131u;
  let twig = normalize(anyWay(&spray) + vec3f(0.0, 0.2, 0.0) + tuftWay * 0.4);
  let reach = tuftSize * (0.7 + 1.1 * stir(&spray));
  // All the leaves of a spray are much of an age, which is what gives a crown its grain.
  let sprayTone = (0.76 + 0.48 * stir(&spray)) * vec3f(0.93 + 0.14 * stir(&spray), 1.0, 0.88 + 0.24 * stir(&spray));
  let out = sqrt(stir(&own));
  let sag = (0.15 + droop * droop * 1.3) * out * out;
  var place = tuftAt + (twig * out + vec3f(0.0, -sag, 0.0)) * reach;
  place += anyWay(&own) * tuftSize * 0.15;
  let inner = 0.3 + 0.7 * out;
  let hangs = droop * out;

  // Leaves lie out from where they grow, and tip down by their weight.
  let outward = normalize(place - lobe.at.xyz);
  let along = normalize(twig + vec3f(0.0, -0.5 - hangs * 1.6, 0.0) + anyWay(&own) * 0.7);
  var normal = normalize(vec3f(0.0, 0.7, 0.0) + outward * 0.5 + anyWay(&own) * 0.75);
  normal = normalize(normal - along * dot(normal, along));
  let across = cross(normal, along);

  // Far smaller than a cell of the map of heights, so drawn larger for it.
  let enlarged = select(1.0, 2.5, view.tile.z > 0.5);
  let leafSize = lobe.leaf.x * 0.55 * (0.74 + 0.5 * stir(&own)) * enlarged;
  let corners = array<vec2f, 4>(vec2f(-1.0, 0.0), vec2f(0.0, -0.46), vec2f(0.0, 0.46), vec2f(1.0, 0.0));
  let offset = corners[corner];
  let world = place + (along * offset.x + across * offset.y) * leafSize;

  // Every leaf has two sides, and only one can be seen.
  let seenFrom = view.eye.xyz - place;
  if (dot(normal, seenFrom) < 0.0) {
    normal = -normal;
  }
  let side = vec2f(dot(normal, view.right.xyz), dot(normal, view.up.xyz));

  let vary = (0.84 + 0.32 * stir(&own)) * vec3f(0.9 + 0.2 * stir(&own), 0.96 + 0.08 * stir(&own), 0.85 + 0.3 * stir(&own));
  let albedo = lobe.tint.rgb * grown.tint * sprayTone * vary;
  let seen = lobe.leaf.y * (0.5 + 0.5 * inner) * (0.78 + 0.22 * (lobe.leaf.w * 0.5 + 0.5));

  let clip = clipped(world);
  let part = ((lobeNumber + 1u) << 4u) | tuftNumber;
  // Leaves ride on their twig, so where a leaf goes is mostly where its tuft goes: by
  // its own place alone, neighbouring leaves would part and shimmer as the tree bends.
  let riding = mix(tuftAt, place, LEAF_OWN);
  let up = saturate((riding.y - lobe.tree.y) / lobe.leaf.z);
  let along_ = saturate(length(riding - lobe.at.xyz) / (size * BRANCH_REACH));
  return Leaf(clip, albedo, side * 0.5 + 0.5, seen, stir(&own), measured(world, clip), part, up, along_);
}

// A length of wood: a ribbon from one place to another, tapering, turned to the eye.
// Of the pieces of a lobe's wood, the first is its limb, the second the trunk it comes
// off, and the rest twigs out to its tufts.
@vertex
fn woodVertex(@builtin(vertex_index) corner: u32, @builtin(instance_index) index: u32) -> Leaf {
  let lobeNumber = index / WOOD_PER_LOBE;
  let piece = index % WOOD_PER_LOBE;
  let lobe = lobes[lobeNumber];
  var state = lobeNumber * 8887u + piece * 37u + 3u;
  let base = vec3f(lobe.tree.x, lobe.tree.y, lobe.tree.z);
  let crown = vec3f(base.x, lobe.tree.w, base.z);
  let reach = lobe.at.xyz - crown;
  let fork = crown - vec3f(0.0, length(reach) * 0.5, 0.0);
  let size = lobe.at.w;

  var from_ = fork;
  var to = lobe.at.xyz;
  var wide = size * 0.05;
  var tuftNumber = 0u;
  if (piece == 1u) {
    from_ = base;
    to = crown;
    wide = size * 0.11;
  } else if (piece > 1u) {
    tuftNumber = piece - 2u;
    from_ = lobe.at.xyz;
    to = tuftOf(lobeNumber, tuftNumber, lobe).at;
    wide = size * 0.02;
  }
  // Limbs bow a little, as nothing that grew is straight.
  let middle = (from_ + to) * 0.5 + anyWay(&state) * length(to - from_) * 0.08;
  let unit = vec2f(f32(corner & 1u), f32(corner >> 1u));
  let along = unit.y;
  let bent = mix(mix(from_, middle, along), mix(middle, to, along), along);
  let tangent = normalize(to - from_);
  let toEye = normalize(view.eye.xyz - bent);
  let aside = normalize(cross(tangent, toEye));
  // Never less than can be seen.
  let least = lobe.leaf.x * 0.32;
  let width = max(wide * (1.0 - along * 0.72), least);
  let world = bent + aside * (unit.x * 2.0 - 1.0) * width;

  // A birch is white, with its dark bands; anything else is a grey-brown bark.
  let birch = lobe.tint.w > 0.55;
  var band = (index * 2654435761u) ^ u32(bent.y * 3.0);
  let marked = select(1.0, 0.45, stir(&band) < 0.3);
  let albedo = select(vec3f(0.07, 0.06, 0.05), vec3f(0.42, 0.41, 0.38) * marked, birch);
  let across = unit.x * 2.0 - 1.0;
  let side = aside * across * 0.8 + toEye * 0.6;
  let facing = vec2f(dot(side, view.right.xyz), dot(side, view.up.xyz));
  let clip = clipped(world);
  let part = ((lobeNumber + 1u) << 4u) | tuftNumber;
  let up = saturate((bent.y - lobe.tree.y) / lobe.leaf.z);
  let along_ = select(saturate(length(bent - lobe.at.xyz) / (size * BRANCH_REACH)), 0.0, piece < 2u);
  return Leaf(clip, albedo, facing * 0.5 + 0.5, lobe.leaf.y * 0.7, 0.5, measured(world, clip), part, up, along_);
}

struct Pixel {
  @location(0) albedo: vec4f,
  @location(1) surface: vec4f,
  @location(2) depth: vec4f,
}

@fragment
fn leafFragment(leaf: Leaf) -> Pixel {
  return Pixel(
    vec4f(sqrt(leaf.albedo), 1.0),
    vec4f(leaf.facing, leaf.seen, leaf.number),
    vec4f(leaf.depth, 0.0, 0.0, 1.0)
  );
}

fn wholePart(leaf: Leaf) -> u32 {
  return leaf.part | (u32(saturate(leaf.out) * 15.0 + 0.5) << 20u) | (u32(saturate(leaf.up) * 255.0 + 0.5) << 24u);
}

// Which part of which tree a pixel is, for the wind.
@fragment
fn leafPart(leaf: Leaf) -> @location(0) u32 {
  return wholePart(leaf);
}

struct Behind {
  @location(0) albedo: vec4f,
  @location(1) surface: vec4f,
  @location(2) part: u32,
}

// What is behind the tree at a pixel, so anything but that tree.
@fragment
fn leafBehind(leaf: Leaf) -> Behind {
  let front = (textureLoad(fronts, vec2i(leaf.position.xy) * 2, 0).r >> 4u) & 0xFFFFu;
  if (front != 0u && owners[front - 1u] >> ${CROWN_BITS}u == owners[(leaf.part >> 4u) - 1u] >> ${CROWN_BITS}u) {
    discard;
  }
  return Behind(
    vec4f(sqrt(leaf.albedo), 1.0),
    vec4f(leaf.facing, leaf.seen * BEHIND_SHADE, leaf.number),
    wholePart(leaf)
  );
}

// How high this is, for the map of heights.
@fragment
fn leafHeight(leaf: Leaf) -> @location(0) vec4f {
  return vec4f(leaf.depth, 0.0, 0.0, 1.0);
}

struct Ground {
  @builtin(position) position: vec4f,
  @location(0) open: f32,
  @location(1) depth: f32,
}

@vertex
fn hullVertex(@location(0) at: vec3f, @location(1) open: f32) -> Ground {
  let clip = clipped(at);
  return Ground(clip, open, measured(at, clip));
}

@fragment
fn hullHeight(ground: Ground) -> @location(0) vec4f {
  return vec4f(ground.depth, 0.0, 0.0, 1.0);
}

const HULL_ALBEDO = vec3f(0.13, 0.17, 0.06);

fn hullSurface(ground: Ground) -> vec4f {
  return vec4f(0.5, 0.75, 0.2 + 0.3 * ground.open, 0.5);
}

@fragment
fn hullFragment(ground: Ground) -> Pixel {
  return Pixel(vec4f(sqrt(HULL_ALBEDO), 1.0), hullSurface(ground), vec4f(ground.depth, 0.0, 0.0, 1.0));
}

// Behind everything, even what is further off: it lies inside the crowns, and only what
// is left when there are no more leaves should show it.
@fragment
fn hullBehind(ground: Ground) -> Behind {
  return Behind(vec4f(sqrt(HULL_ALBEDO), 1.0), hullSurface(ground) * vec4f(1.0, 1.0, BEHIND_SHADE, 1.0), 1u);
}
`

/** The second half of the leaves' shader: the ground is a part that never moves. */
const groundPartSource = /* wgsl */ `
@fragment
fn groundPart() -> @location(0) u32 {
  return 1u;
}
`

/** Darkens each pixel by what stands around it, once, into the surface's blue. */
export const hollowSource = /* wgsl */ `
const TAPS = 18;
// How much it can darken a pixel, and how wide it looks, in pixels.
const STRENGTH = 0.55;
const WIDEST = 30.0;

@group(0) @binding(0) var depths: texture_2d<f32>;

${overSource}
${interleavedSource}

// How deep a pixel is, by its coverage, or 0 with nothing in it, as off the panorama,
// which a GPU may otherwise answer as it likes.
fn depthAt(pixel: vec2i) -> f32 {
  if (any(pixel < vec2i(0)) || any(pixel >= vec2i(textureDimensions(depths)))) {
    return 0.0;
  }
  return textureLoad(depths, pixel, 0).r;
}

@fragment
fn hollowFragment(over: Over) -> @location(0) vec4f {
  let pixel = vec2i(over.position.xy);
  let depth = depthAt(pixel);
  if (depth <= 0.0) {
    return vec4f(1.0);
  }
  // Turned for each pixel, so that what few taps there are can't make a pattern.
  let spin = interleaved(over.position.xy + vec2f(0.0, ${PANORAMA_TOP}.0)) * 6.2831853;
  // What is near in metres is further in pixels: this is a fixed width in the world.
  let scale = 180.0 / depth;
  var hidden = 0.0;
  for (var i = 0; i < TAPS; i++) {
    let share = (f32(i) + 0.5) / f32(TAPS);
    let turn = f32(i) * 2.39996323 + spin;
    let reach = sqrt(share) * WIDEST * scale;
    let tap = pixel + vec2i(vec2f(cos(turn), sin(turn)) * reach);
    let ahead = depth - depthAt(tap);
    // In front of it by more than a leaf, and not so far as to be nothing to do with it.
    hidden += smoothstep(0.25, 2.2, ahead) * (1.0 - smoothstep(9.0, 26.0, ahead));
  }
  return vec4f(1.0 - STRENGTH * saturate(hidden / f32(TAPS) * 2.4));
}
`

/**
 * How much of the sky each pixel can see, past the trees around it, once, into the
 * surface's blue: all round, out across the map of heights, by the highest it finds.
 */
export function openSource(halfWide: number, halfHigh: number, eye: readonly number[], axes: readonly number[][]) {
  const vec3 = (v: readonly number[]) => `vec3f(${v.map((n) => n.toFixed(6)).join(', ')})`
  return /* wgsl */ `
const WAYS = 10;
const STEPS = 7;
const NEAREST = 0.8;
const GROWTH = 1.75;
// How much is taken for the leaf itself, in metres, so that it doesn't shade itself.
const SKIN = 0.35;
// Leaves pass on most of the light that reaches them, from one to the next, so that a
// wood is far lighter inside than what it can see of the sky would make it. This is how
// much of the light each bounce passes on.
const BOUNCE = 0.78;

@group(0) @binding(0) var depths: texture_2d<f32>;
@group(0) @binding(1) var albedos: texture_2d<f32>;
@group(0) @binding(2) var heights: texture_2d<f32>;
@group(0) @binding(3) var smooth_: sampler;

${overSource}
${interleavedSource}
${heightsSource}

@fragment
fn openFragment(over: Over) -> @location(0) vec4f {
  let pixel = vec2i(over.position.xy);
  let cover = textureLoad(albedos, pixel, 0).a;
  if (cover < 0.05) {
    return vec4f(1.0);
  }
  let whole = over.position.xy + vec2f(0.0, ${PANORAMA_TOP}.0);
  let uv = whole / vec2f(${PANORAMA_WIDTH}.0, ${PANORAMA_HEIGHT}.0);
  let ray = ${vec3(axes[2])}
    + ${vec3(axes[0])} * (uv.x * 2.0 - 1.0) * ${halfWide}
    + ${vec3(axes[1])} * (1.0 - uv.y * 2.0) * ${halfHigh};
  let world = ${vec3(eye)} + ray * textureLoad(depths, pixel, 0).r / cover;

  let spin = interleaved(whole) * 6.2831853;
  var hidden = 0.0;
  for (var w = 0; w < WAYS; w++) {
    let turn = f32(w) * 6.2831853 / f32(WAYS) + spin;
    let way = vec2f(cos(turn), sin(turn));
    var highest = 0.0;
    var along = NEAREST;
    for (var s = 0; s < STEPS; s++) {
      highest = max(highest, (heightAt(world.xz + way * along) - world.y - SKIN) / along);
      along *= GROWTH;
    }
    // Of a hemisphere, what a horizon this high takes away.
    hidden += highest * highest / (1.0 + highest * highest);
  }
  let seen = saturate(1.0 - hidden / f32(WAYS));
  return vec4f(seen / (1.0 - BOUNCE * (1.0 - seen)));
}
`
}

/** Lets the page breathe: `pause` for its next task, once the device has caught up. */
async function caughtUp(device: GPUDevice, pause: () => Promise<unknown>) {
  await device.queue.onSubmittedWorkDone()
  await pause()
}

/** The buffers of a stand that drawing it reads. */
export interface StandBuffers {
  lobes: GPUBuffer
  owners: GPUBuffer
  blocks: GPUBuffer
  hullVertices: GPUBuffer
  hullIndices: GPUBuffer
}

/** The pipelines of one way of drawing everything, in the order it is drawn. */
interface Drawing {
  hull: GPURenderPipeline
  leaf: GPURenderPipeline
  wood?: GPURenderPipeline
}

/** Draws the panorama. It goes in `kept`, along with the scene that asked for it. */
export async function bakePanorama(
  device: GPUDevice,
  stand: Stand,
  buffers: StandBuffers,
  { keep, pause }: Kept,
): Promise<Panorama> {
  const { TEXTURE_BINDING, RENDER_ATTACHMENT, COPY_DST } = GPUTextureUsage
  // Each is copied into from the tiles; the albedos and surfaces are drawn into as well, for their mips and the sky they see.
  const finished = (label: string, format: GPUTextureFormat, mipLevelCount: number, drawn: boolean) =>
    keep(
      device.createTexture({
        label,
        size: [PANORAMA_WIDTH, PANORAMA_ROWS],
        format,
        mipLevelCount,
        usage: TEXTURE_BINDING | COPY_DST | (drawn ? RENDER_ATTACHMENT : 0),
      }),
    )
  const behind = (name: string, n: number) =>
    keep(
      device.createTexture({
        label: `forest ${name} behind`,
        size: [Math.ceil(PANORAMA_WIDTH / 2), PANORAMA_ROWS / 2],
        format: BEHIND_FORMATS[n],
        usage: TEXTURE_BINDING | COPY_DST,
      }),
    )
  const panorama: Drawn = {
    albedos: finished('forest albedos', SURFACE_FORMAT, PANORAMA_MIPS, true),
    surfaces: finished('forest surfaces', SURFACE_FORMAT, PANORAMA_MIPS, true),
    depths: finished('forest depths', DEPTH_FORMAT, 1, false),
    parts: finished('forest parts', PART_FORMAT, 1, false),
    heights: keep(
      device.createTexture({
        label: 'forest heights',
        size: [HEIGHTS_WIDTH, HEIGHTS_DEPTH],
        format: DEPTH_FORMAT,
        usage: TEXTURE_BINDING | RENDER_ATTACHMENT,
      }),
    ),
    behindAlbedos: behind('albedos', 0),
    behindSurfaces: behind('surfaces', 1),
    behindParts: behind('parts', 2),
  }

  const spare = keeper(device)
  try {
    await drawTiles(device, stand, buffers, panorama, spare.keep, pause)
  } finally {
    spare.release()
  }
  await shapeUp(device, panorama, pause)
  await caughtUp(device, pause)
  return { ...panorama, openTo: await lowestGap(device, panorama) }
}

/** Draws everything into `panorama`, a tile at a time, on what it hands to `keep` to be let go of after. */
async function drawTiles(
  device: GPUDevice,
  stand: Stand,
  { lobes, owners, blocks, hullVertices, hullIndices }: StandBuffers,
  { albedos, surfaces, depths, parts, heights, behindAlbedos, behindSurfaces, behindParts }: Drawn,
  keep: Kept['keep'],
  pause: () => Promise<unknown>,
) {
  const camera = panoramaCamera()
  const { TEXTURE_BINDING, RENDER_ATTACHMENT, COPY_SRC } = GPUTextureUsage
  const tileSize = [TILE_WIDTH, PANORAMA_HEIGHT]
  const tileTexture = (
    format: GPUTextureFormat,
    sampleCount: number,
    usage: GPUTextureUsageFlags,
    size: number[] = tileSize,
  ) => keep(device.createTexture({ size, format, sampleCount, usage }))
  const formats = [SURFACE_FORMAT, SURFACE_FORMAT, DEPTH_FORMAT]
  const samples = formats.map((format) => tileTexture(format, SAMPLES, RENDER_ATTACHMENT).createView())
  const resolved = formats.map((format) => tileTexture(format, 1, RENDER_ATTACHMENT | COPY_SRC))
  const depthView = tileTexture('depth32float', SAMPLES, RENDER_ATTACHMENT).createView()
  // A part can't be averaged across samples, so those are drawn again with none.
  const partTile = tileTexture(PART_FORMAT, 1, RENDER_ATTACHMENT | COPY_SRC | TEXTURE_BINDING)
  const partDepthView = tileTexture('depth32float', 1, RENDER_ATTACHMENT).createView()
  const behindTileWidth = Math.ceil(TILE_WIDTH / 2)
  const behindSize = [behindTileWidth, Math.ceil(PANORAMA_HEIGHT / 2)]
  const behindTiles = BEHIND_FORMATS.map((format) => tileTexture(format, 1, RENDER_ATTACHMENT | COPY_SRC, behindSize))
  const behindDepthView = tileTexture('depth32float', 1, RENDER_ATTACHMENT, behindSize).createView()

  // Two groups: the tile and the stand, read by every draw, and what is at the front, which
  // only the drawing of what is behind reads, as it is being drawn on until then.
  const { VERTEX, FRAGMENT } = GPUShaderStage
  const standLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: VERTEX, buffer: { type: 'uniform' } },
      { binding: 1, visibility: VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: VERTEX, buffer: { type: 'read-only-storage' } },
    ],
  })
  const frontLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: FRAGMENT, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: FRAGMENT, texture: { sampleType: 'uint' } },
    ],
  })
  const layout = device.createPipelineLayout({ bindGroupLayouts: [standLayout] })
  const behindLayout = device.createPipelineLayout({ bindGroupLayouts: [standLayout, frontLayout] })

  const module = device.createShaderModule({ code: leafSource + groundPartSource })
  const depthStencil: GPUDepthStencilState = {
    format: 'depth32float',
    depthCompare: 'greater',
    depthWriteEnabled: true,
  }
  const hullBuffers: GPUVertexBufferLayout[] = [
    {
      arrayStride: HULL_STRIDE * 4,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32' },
      ],
    },
  ]
  const targets = (list: GPUTextureFormat[]) => list.map((format) => ({ format }))
  const colours = targets(formats)
  const partTargets = targets([PART_FORMAT])
  const heightTargets = targets([DEPTH_FORMAT])
  const behindTargets = targets(BEHIND_FORMATS)

  function pipeline(
    vertex: 'hullVertex' | 'leafVertex' | 'woodVertex',
    entryPoint: string,
    fragmentTargets: GPUColorTargetState[],
    more: Partial<GPURenderPipelineDescriptor> = {},
  ) {
    const hull = vertex === 'hullVertex'
    return device.createRenderPipelineAsync({
      label: `forest ${entryPoint}`,
      layout,
      vertex: { module, entryPoint: vertex, buffers: hull ? hullBuffers : [] },
      fragment: { module, entryPoint, targets: fragmentTargets },
      primitive: { topology: hull ? 'triangle-list' : 'triangle-strip' },
      depthStencil,
      ...more,
    })
  }

  const sampled = { multisample: { count: SAMPLES } }
  const withFront = { layout: behindLayout }
  const [leaf, hull, wood, leafPart, hullPart, woodPart, leafHeight, hullHeight, leafBehind, hullBehind, woodBehind] =
    await Promise.all([
      pipeline('leafVertex', 'leafFragment', colours, sampled),
      pipeline('hullVertex', 'hullFragment', colours, sampled),
      pipeline('woodVertex', 'leafFragment', colours, sampled),
      pipeline('leafVertex', 'leafPart', partTargets),
      pipeline('hullVertex', 'groundPart', partTargets),
      pipeline('woodVertex', 'leafPart', partTargets),
      pipeline('leafVertex', 'leafHeight', heightTargets),
      pipeline('hullVertex', 'hullHeight', heightTargets),
      pipeline('leafVertex', 'leafBehind', behindTargets, withFront),
      pipeline('hullVertex', 'hullBehind', behindTargets, {
        ...withFront,
        depthStencil: { format: 'depth32float', depthCompare: 'always', depthWriteEnabled: false },
      }),
      pipeline('woodVertex', 'leafBehind', behindTargets, withFront),
    ])

  const tile = keep(
    device.createBuffer({ size: TILE_UNIFORMS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
  )
  const tileData = new Float32Array(TILE_UNIFORMS)
  tileData.set([...camera.right, 1 / camera.halfWidth], 0)
  tileData.set([...camera.up, 1 / camera.halfHeight], 4)
  tileData.set([...camera.forward, camera.near], 8)
  tileData.set(camera.eye, 12)
  const standGroup = device.createBindGroup({
    layout: standLayout,
    entries: [
      { binding: 0, resource: { buffer: tile } },
      { binding: 1, resource: { buffer: lobes } },
      { binding: 2, resource: { buffer: blocks } },
    ],
  })
  const frontGroup = device.createBindGroup({
    layout: frontLayout,
    entries: [
      { binding: 0, resource: { buffer: owners } },
      { binding: 1, resource: partTile.createView() },
    ],
  })

  const woodPieces = stand.lobeCount * WOOD_PER_LOBE

  /** Draws everything in a pass, and ends it: the ground, then `count` blocks of leaves, then the wood. */
  function drawAll(pass: GPURenderPassEncoder, drawing: Drawing, first: number, count: number) {
    pass.setBindGroup(0, standGroup)
    pass.setPipeline(drawing.hull)
    pass.setVertexBuffer(0, hullVertices)
    pass.setIndexBuffer(hullIndices, 'uint16')
    pass.drawIndexed(stand.hullIndices.length)
    pass.setPipeline(drawing.leaf)
    pass.draw(4, count * LEAF_BLOCK, 0, first * LEAF_BLOCK)
    if (drawing.wood) {
      pass.setPipeline(drawing.wood)
      pass.draw(4, woodPieces)
    }
    pass.end()
  }

  function depthOf(view: GPUTextureView): GPURenderPassDepthStencilAttachment {
    return { view, depthLoadOp: 'clear', depthClearValue: 0, depthStoreOp: 'discard' }
  }

  // The map of heights, first of all, in its own depth.
  {
    const overhead = keep(
      device.createTexture({
        size: [HEIGHTS_WIDTH, HEIGHTS_DEPTH],
        format: 'depth32float',
        usage: RENDER_ATTACHMENT,
      }),
    )
    tileData.set([1, 0, 1], 16)
    device.queue.writeBuffer(tile, 0, tileData)
    const encoder = device.createCommandEncoder({ label: 'forest heights' })
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        { view: heights.createView(), loadOp: 'clear', clearValue: [LOWEST, 0, 0, 1], storeOp: 'store' },
      ],
      depthStencilAttachment: depthOf(overhead.createView()),
    })
    drawAll(pass, { hull: hullHeight, leaf: leafHeight }, 0, stand.blocks.length)
    device.queue.submit([encoder.finish()])
    await caughtUp(device, pause)
    overhead.destroy()
  }

  for (let i = 0; i < TILES; i++) {
    const left = -1 + (2 * i) / TILES
    const right = left + 2 / TILES
    tileData.set([TILES, (left + right) / 2, 0], 16)
    device.queue.writeBuffer(tile, 0, tileData)
    const [first, count] = blocksInStrip(stand, left * camera.halfWidth, right * camera.halfWidth)

    const encoder = device.createCommandEncoder({ label: 'forest tile' })
    drawAll(
      encoder.beginRenderPass({
        colorAttachments: samples.map((view, n) => ({
          view,
          resolveTarget: resolved[n].createView(),
          loadOp: 'clear' as const,
          clearValue: [0, 0, 0, 0],
          storeOp: 'discard' as const,
        })),
        depthStencilAttachment: depthOf(depthView),
      }),
      { hull, leaf, wood },
      first,
      count,
    )
    drawAll(
      encoder.beginRenderPass({
        colorAttachments: [
          { view: partTile.createView(), loadOp: 'clear', clearValue: [0, 0, 0, 0], storeOp: 'store' },
        ],
        depthStencilAttachment: depthOf(partDepthView),
      }),
      { hull: hullPart, leaf: leafPart, wood: woodPart },
      first,
      count,
    )
    const behindPass = encoder.beginRenderPass({
      colorAttachments: behindTiles.map((texture) => ({
        view: texture.createView(),
        loadOp: 'clear' as const,
        clearValue: [0, 0, 0, 0],
        storeOp: 'store' as const,
      })),
      depthStencilAttachment: depthOf(behindDepthView),
    })
    behindPass.setBindGroup(1, frontGroup)
    drawAll(behindPass, { hull: hullBehind, leaf: leafBehind, wood: woodBehind }, first, count)

    const width = Math.min(TILE_WIDTH, PANORAMA_WIDTH - i * TILE_WIDTH)
    const behindWidth = Math.min(behindTileWidth, behindAlbedos.width - i * behindTileWidth)
    // Everything is drawn at full height, and only what isn't sky is kept.
    const copyTo = (texture: GPUTexture, destination: GPUTexture, x: number, top: number, size: number[]) =>
      encoder.copyTextureToTexture({ texture, origin: [0, top] }, { texture: destination, origin: [x, 0] }, size)
    const whole = [width, PANORAMA_ROWS]
    copyTo(partTile, parts, i * TILE_WIDTH, PANORAMA_TOP, whole)
    copyTo(resolved[0], albedos, i * TILE_WIDTH, PANORAMA_TOP, whole)
    copyTo(resolved[1], surfaces, i * TILE_WIDTH, PANORAMA_TOP, whole)
    copyTo(resolved[2], depths, i * TILE_WIDTH, PANORAMA_TOP, whole)
    const half = [behindWidth, PANORAMA_ROWS / 2]
    copyTo(behindTiles[0], behindAlbedos, i * behindTileWidth, PANORAMA_TOP / 2, half)
    copyTo(behindTiles[1], behindSurfaces, i * behindTileWidth, PANORAMA_TOP / 2, half)
    copyTo(behindTiles[2], behindParts, i * behindTileWidth, PANORAMA_TOP / 2, half)
    device.queue.submit([encoder.finish()])
    await caughtUp(device, pause)
  }
}

/** All that follows the drawing: how much sky each pixel sees, the hollows, then the mips. */
async function shapeUp(
  device: GPUDevice,
  { albedos, surfaces, depths, heights }: Drawn,
  pause: () => Promise<unknown>,
) {
  const { eye, right, up, forward, halfWidth, halfHeight } = panoramaCamera()
  const openModule = device.createShaderModule({ code: openSource(halfWidth, halfHeight, eye, [right, up, forward]) })
  const hollowModule = device.createShaderModule({ code: hollowSource })

  // Multiplied into the blue alone.
  const intoBlue: GPUColorTargetState[] = [
    {
      format: SURFACE_FORMAT,
      writeMask: GPUColorWrite.BLUE,
      blend: {
        color: { srcFactor: 'dst', dstFactor: 'zero' },
        alpha: { srcFactor: 'zero', dstFactor: 'one' },
      },
    },
  ]
  const [openPipeline, hollowPipeline, mipPipeline] = await Promise.all([
    device.createRenderPipelineAsync({
      label: 'forest open sky',
      layout: 'auto',
      vertex: { module: openModule, entryPoint: 'overVertex' },
      fragment: { module: openModule, entryPoint: 'openFragment', targets: intoBlue },
      primitive: { topology: 'triangle-list' },
    }),
    device.createRenderPipelineAsync({
      label: 'forest hollows',
      layout: 'auto',
      vertex: { module: hollowModule, entryPoint: 'overVertex' },
      fragment: { module: hollowModule, entryPoint: 'hollowFragment', targets: intoBlue },
      primitive: { topology: 'triangle-list' },
    }),
    createMipPipeline(device, SURFACE_FORMAT, 'forest mips'),
  ])

  // A strip at a time, as this is a lot of looking for one go.
  const openGroup = device.createBindGroup({
    layout: openPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: depths.createView() },
      { binding: 1, resource: albedos.createView({ baseMipLevel: 0, mipLevelCount: 1 }) },
      { binding: 2, resource: heights.createView() },
      { binding: 3, resource: device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) },
    ],
  })
  for (let i = 0; i < TILES; i++) {
    const encoder = device.createCommandEncoder({ label: 'forest open sky' })
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        { view: surfaces.createView({ baseMipLevel: 0, mipLevelCount: 1 }), loadOp: 'load', storeOp: 'store' },
      ],
    })
    pass.setScissorRect(i * TILE_WIDTH, 0, Math.min(TILE_WIDTH, PANORAMA_WIDTH - i * TILE_WIDTH), PANORAMA_ROWS)
    pass.setPipeline(openPipeline)
    pass.setBindGroup(0, openGroup)
    pass.draw(3)
    pass.end()
    device.queue.submit([encoder.finish()])
    await caughtUp(device, pause)
  }

  const encoder = device.createCommandEncoder({ label: 'forest shaping' })
  const hollows = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: surfaces.createView({ baseMipLevel: 0, mipLevelCount: 1 }),
        loadOp: 'load',
        storeOp: 'store',
      },
    ],
  })
  hollows.setPipeline(hollowPipeline)
  hollows.setBindGroup(
    0,
    device.createBindGroup({
      layout: hollowPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: depths.createView() }],
    }),
  )
  hollows.draw(3)
  hollows.end()

  for (const texture of [albedos, surfaces]) mipChain(device, mipPipeline, texture)(encoder)
  device.queue.submit([encoder.finish()])
}

/** How much of the panorama a view of this shape shows, across and down. */
export function viewShare(aspect: number): [number, number] {
  const seen = forestCamera(aspect)
  const whole = panoramaCamera()
  return [seen.halfWidth / whole.halfWidth, seen.halfHeight / whole.halfHeight]
}
