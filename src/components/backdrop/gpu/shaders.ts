// WGSL for the backdrop renderer: one vertex entry point and a fragment entry
// point per pass, sharing one set of uniforms. Every pass draws a quad given in
// CSS px from the viewport's top-left; `map` turns a CSS px position into the uv
// of the texture being read (the image's cover fit, or a screen-sized target).
//
// The image and its blurs are premultiplied and keep their alpha, so that a blur
// mixes see-through pixels by how much of them there is. It is only drawn on a
// canvas over `matte`, the colour behind the image, as glass has to replace the
// image under it rather than be laid over it, and a popup's has to hide the page.
import { fadeEaseWgsl } from '../../../shared'

/** How many looks at the image frosted glass takes for each colour of a fragment. */
const FROST_TAPS = 16

/**
 * Those looks, as lines of WGSL for `frosted`. Each falls at a multiple of the blur's
 * standard deviation: evenly weighted samples of a Gaussian, each radius taking an
 * equal share of it, and each turned from the last by the golden angle, so that no two
 * line up. Written out one by one, as a loop over a const array can be copied into
 * every fragment's local memory (on D3D12 it made the galaxy's bake ten times slower).
 */
const frostTaps = Array.from({ length: FROST_TAPS }, (_, i) => {
  const radius = Math.sqrt(-2 * Math.log(1 - (i + 0.5) / FROST_TAPS))
  const angle = i * Math.PI * (3 - Math.sqrt(5))
  const tap = `vec2f(${(radius * Math.cos(angle)).toFixed(4)}, ${(radius * Math.sin(angle)).toFixed(4)})`
  return `  sum += textureSampleLevel(src, bilinear, (px + ${tap} * sigma) * u.map.xy + u.map.zw, level);`
})

/** Where each field of `Uniforms` below starts, in 32-bit floats. */
export const UNIFORM = {
  quad: 0,
  view: 4,
  map: 8,
  clip: 12,
  feather: 16,
  dispersion: 20,
  opacity: 23,
  axis: 24,
  sigma: 26,
  taps: 27,
  radius: 28,
  bezel: 29,
  strength: 30,
  squircle: 31,
  matte: 32,
  pixel: 35,
  hole: 36,
  soft: 37,
  frost: 38,
} as const

/** The size of `Uniforms`, in bytes. */
export const UNIFORM_SIZE = 160

export const shaderSource = /* wgsl */ `
struct Uniforms {
  // The quad to draw: left, top, width, height.
  quad: vec4f,
  // The part of the viewport the target shows: left, top, width, height.
  view: vec4f,
  map: vec4f,
  clip: vec4f,
  feather: vec4f,
  dispersion: vec3f,
  opacity: f32,
  axis: vec2f,
  sigma: f32,
  taps: f32,
  radius: f32,
  bezel: f32,
  strength: f32,
  squircle: f32,
  // The colour behind the image, showing wherever it is see-through.
  matte: vec3f,
  pixel: f32,
  // The radius of a round hole through the middle of a lens, making it a ring; 0 for none.
  hole: f32,
  // How far the lens's edges fade across, centred on them; 0 for as sharp as a pixel allows.
  soft: f32,
  // The blur at the top of frosted glass, with sigma's at its bottom; 0 for glass that isn't frosted.
  frost: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var bilinear: sampler;
@group(1) @binding(0) var src: texture_2d<f32>;

struct Fragment {
  @builtin(position) position: vec4f,
  @location(0) px: vec2f,
}

fn corner(index: u32, origin: vec2f, size: vec2f) -> Fragment {
  let unit = vec2f(f32(index & 1u), f32(index >> 1u));
  let px = origin + unit * size;
  let device = ((px - u.view.xy) / u.view.zw * 2.0 - 1.0) * vec2f(1.0, -1.0);
  return Fragment(vec4f(device, 0.0, 1.0), px);
}

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> Fragment {
  return corner(index, u.quad.xy, u.quad.zw);
}

// Larger on every side, by a device pixel or a soft edge: an outline's fade reaches
// past it, and only fragments inside the quad are drawn at all. u.quad stays the
// element's box, which lensMain measures from.
@vertex
fn lensVertex(@builtin(vertex_index) index: u32) -> Fragment {
  let reach = max(u.pixel, u.soft);
  return corner(index, u.quad.xy - reach, u.quad.zw + 2.0 * reach);
}

// A premultiplied colour of the image, over the colour behind it.
fn opaque(color: vec4f) -> vec3f {
  return color.rgb + u.matte * (1.0 - color.a);
}

// The image as is, at u.opacity (premultiplied), for one crossfading in over another.
@fragment
fn imageMain(@location(0) px: vec2f) -> @location(0) vec4f {
  let rgb = opaque(textureSample(src, bilinear, px * u.map.xy + u.map.zw));
  return vec4f(rgb * u.opacity, u.opacity);
}

// One axis of a Gaussian blur, a tap per device pixel along u.axis. No taps is a plain
// copy, which is how the image's mipmaps are made.
//
// The taps go out from the middle in pairs, each weighted by the last one's weight times
// a step, and each step the last one's times the same factor: a Gaussian with a
// multiplication a tap, where an exp of its own cost a quarter of the blur. Every factor
// is at most 1, so however narrow the blur, nothing overflows.
@fragment
fn blurMain(@location(0) px: vec2f) -> @location(0) vec4f {
  let taps = i32(u.taps);
  let spread = max(u.sigma * u.sigma, 1e-6);
  var sum = textureSample(src, bilinear, px * u.map.xy + u.map.zw);
  var total = 1.0;
  var w = 1.0;
  var step = exp(-0.5 / spread);
  let narrowing = exp(-1.0 / spread);
  for (var i = 1; i <= taps; i++) {
    w *= step;
    step *= narrowing;
    let along = f32(i) * u.axis;
    let pair = textureSample(src, bilinear, (px + along) * u.map.xy + u.map.zw)
      + textureSample(src, bilinear, (px - along) * u.map.xy + u.map.zw);
    sum += w * pair;
    total += 2.0 * w;
  }
  return sum / total;
}

// A squircle corner is x⁴ + y⁴ = r⁴, a round one x² + y² = r².
fn cornerLength(q: vec2f) -> f32 {
  if (u.squircle > 0.5) {
    let squared = q * q;
    return sqrt(sqrt(dot(squared, squared)));
  }
  return length(q);
}

// Negative inside the rounded rect centred on the origin, zero on its outline.
fn roundedRect(p: vec2f, halfSize: vec2f, radius: f32) -> f32 {
  let r = min(radius, min(halfSize.x, halfSize.y));
  let q = abs(p) - halfSize + r;
  return cornerLength(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// Level 0 by name: a discarded fragment leaves no derivatives to pick one by,
// and the blurred images have no others.
fn backdrop(px: vec2f) -> vec3f {
  return opaque(textureSampleLevel(src, bilinear, px * u.map.xy + u.map.zw, 0.0));
}

// The image under a Gaussian blur of any width, in CSS px. A blur made ahead has
// one width, and frosted glass wants a different one at every height, which a mix
// of two would only fake: it shows the sharper one through the other, as a double
// image. So this blurs here and now, at the cost of looks per fragment rather than
// of a pass over the whole viewport, which is cheap for a small lens. Each look is
// at a mip half as wide again as the blur, as the outermost looks are that far apart
// and a single bright pixel between them would flicker in and out of view, and that
// mip moves as smoothly as the blur does. So src has to have mips: the image.
fn frosted(px: vec2f, sigma: f32) -> vec3f {
  let texels = sigma * u.map.x * f32(textureDimensions(src, 0).x);
  let level = log2(max(texels * 1.5, 1.0));
  var sum = vec4f(0.0);
${frostTaps.join('\n')}
  return opaque(sum / ${FROST_TAPS}.0);
}

// What the glass shows at px: of the image if it is frosted, or of the blurred image in src.
fn behind(px: vec2f, sigma: f32) -> vec3f {
  if (u.frost > 0.0) {
    return frosted(px, sigma);
  }
  return backdrop(px);
}

// One element's glass: the blurred backdrop, bent at the edges and saturated,
// inside the element's rounded (or squircle) outline.
//
// The bend is towards the middle, by a ramp across the box on each axis, scaled
// by how much of the bend is left this far in from the outline: all of it at the
// edge, easing to none, with no slope, a bezel in. Each channel samples displaced
// by its own fraction of the strength, which fringes the edges. The whole lens
// fades by u.opacity, the element's opacity on screen.
//
// With a hole through it the lens is a ring, as thick glass bent into a hoop: the
// hole's edge is an outline too, and the middle it all bends towards is the ring's
// own, halfway between its two edges all the way round, so the bend turns with it.
// The bezel is at most half the ring's width (bezelWidth), so the bend has eased to
// nothing by the time it changes direction there.
//
// Frosted glass trades the bend for blur on the way up: all of the bend and u.sigma
// at the bottom of the box, none of the bend and u.frost at the top. Both go by one
// ease, so one is gone just as the other arrives, and it is smootherstep rather than
// smoothstep, as what the eye picks out is where a change starts and stops, and
// this leaves no corner there in its slope or its curve. The blur moves by ratios
// rather than amounts, as doubling it looks the same at any width: by amounts it
// would have nearly all of its way to go in the first few px up from the bottom.
@fragment
fn lensMain(@location(0) px: vec2f) -> @location(0) vec4f {
  let halfSize = u.quad.zw * 0.5;
  let local = px - u.quad.xy;
  let p = local - halfSize;

  var edge = roundedRect(p, halfSize, u.radius);
  // Towards the middle at the edges, so it never samples from beyond them.
  var towards = 0.5 - local / u.quad.zw;
  if (u.hole > 0.0) {
    let out = length(p);
    let inner = u.hole - out;
    towards = p / max(out, 1e-3) * select(0.5, -0.5, edge > inner);
    edge = max(edge, inner);
  }
  // Cut off at the clip's sides, fading in over u.feather from any that fade, by
  // the curve a scroller's content fades by there.
  let feather = max(u.feather, vec4f(1e-4));
  let nearIn = clamp((px - u.clip.xy) / feather.xy, vec2f(0.0), vec2f(1.0));
  let farIn = clamp((u.clip.zw - px) / feather.zw, vec2f(0.0), vec2f(1.0));
  let near = ${fadeEaseWgsl('nearIn')};
  let far = ${fadeEaseWgsl('farIn')};
  let clipped = near.x * near.y * far.x * far.y;
  let coverage = clamp(0.5 - edge / max(u.pixel, u.soft), 0.0, 1.0) * clipped * u.opacity;
  if (coverage <= 0.0) {
    discard;
  }

  var clear = 1.0;
  var sigma = 0.0;
  if (u.frost > 0.0) {
    let down = clamp(local.y / u.quad.w, 0.0, 1.0);
    clear = down * down * down * (down * (down * 6.0 - 15.0) + 10.0);
    // A blur of none has no ratio to move by.
    let least = max(u.sigma, 0.25);
    sigma = least * pow(u.frost / least, 1.0 - clear);
  }

  let rest = 1.0 - clamp(-edge / max(u.bezel, 1e-3), 0.0, 1.0);
  let left = rest * rest * clear;
  let bend = u.strength * towards * left;

  // Most of a lens isn't bent at all, and there one look is as good as three. So it is
  // where a blur would hide how far the colours part, which frost's looks make worth asking.
  var bent = behind(px + bend * u.dispersion.r, sigma);
  if (length(bend) * (u.dispersion.b - u.dispersion.r) > sigma * 0.25) {
    bent = vec3f(bent.r, behind(px + bend * u.dispersion.g, sigma).g, behind(px + bend * u.dispersion.b, sigma).b);
  }
  // CSS saturate(1.6).
  let luma = vec3f(dot(bent, vec3f(0.213, 0.715, 0.072)));
  let rgb = clamp(mix(luma, bent, 1.6), vec3f(0.0), vec3f(1.0));
  return vec4f(rgb * coverage, coverage);
}
`
