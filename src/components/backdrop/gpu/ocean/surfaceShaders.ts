// WGSL for the ocean's surface: a tile's vertices, morphed and displaced by the
// waves, and what the eye sees of it.
//
// A pixel of ocean is lit in three parts, after Bruneton, Neyret and Holzschuch's
// seamless ocean lighting. Slopes the cascades can show it reads from them, and
// mipmaps fade each out as its waves become too small for the pixel. What
// mipmaps take away has to go somewhere, or the ocean would go flat and mirror-like
// in the distance: it comes back as roughness, a variance of slope that widens
// the reflection of the sun, or of the moon by night, and of the sky. So up close,
// where the smallest cascade is resolved, either is thousands of tiny, sharp points;
// far off, the same waves add up to the broad glitter path that lies beneath it.
import { MORPH_START, REACH_SPACINGS, TILE_QUADS } from './cdlod'
import { LACE_CASCADE } from './fftShaders'
import { RIPPLE_TILE } from './rainShaders'

/**
 * How far below the horizon the ocean has faded into the sky, in radians: about 28 pixels
 * at 1080p. A blur would ask for a pass over the whole frame every frame.
 */
const HORIZON_SOFTNESS = 0.02

/** How far off the haze over the ocean takes most of it, in metres. */
const HAZE_DISTANCE = 26000

export const surfaceSource = /* wgsl */ `
const SIDE = ${TILE_QUADS + 1}u;
const REACH = ${REACH_SPACINGS}.0;
const MORPH_START = ${MORPH_START};

// The water's own colour, by how it scatters sunlight back up, and that of light
// that has passed through the thin top of a wave: the blue of deep water far from
// land, with less green in it than a lagoon's, and its crests less turquoise.
const DEEP = vec3f(0.0019, 0.0135, 0.040);
const THROUGH_CREST = vec3f(0.005, 0.058, 0.078);
// The angular size of the sun and moon, as a variance of slope.
const DISC_VARIANCE = 2e-5;
const HORIZON_SOFTNESS = ${HORIZON_SOFTNESS};
// How far up the sky rough water mirrors the clouds, over where a flat ocean would, as the
// sine of a height: as the sky's own reflection is lifted, by the facets turned to the
// eye. And how much of them it mirrors, by day and by night, as the rest of its facets
// mirror other sky, and how blurred, as a mip of their texture: each is half as sharp.
const CLOUD_LIFT = 0.04;
const CLOUD_MIRROR_DAY = 0.143;
const CLOUD_MIRROR_NIGHT = 0.41;
const CLOUD_BLUR_DAY = 2.6;
const CLOUD_BLUR_NIGHT = 2.0;
// The mip of the clouds' texture read for how much of the sun or moon they hide, about as
// wide as a disc.
const LAMP_CLOUD_BLUR = 1.0;
// How much of the roughness of unseen waves is spent, near the camera: the rest
// is held back to leave its glints sharp.
const NEAR_ROUGHNESS = 0.09;
// What rain does to the water. Rings too small for a pixel are roughness like any other
// waves, which is why an ocean in the rain is matte and has no glitter on it. The second
// layer of rings is the first again, larger and turned, so that the tile doesn't show.
// Over the water hangs spray, which takes the far ocean and the horizon with it.
const RIPPLE_TILE = ${RIPPLE_TILE}.0;
const RIPPLE_LARGER = 2.71;
const RIPPLE_LARGER_SLOPE = 0.65;
const RAIN_GREY = 0.45;
const RAIN_DARK = 0.6;
const RAIN_VARIANCE = 0.012;
const RAIN_VARIANCE_FOOTPRINT = 0.25;
const HAZE_DISTANCE = ${HAZE_DISTANCE};
const RAIN_HAZE_DISTANCE = 2600.0;
// Foam rides on the water, so it bunches where the short waves draw the surface together
// and thins where they pull it apart: a whitecap is broken into patches and lace rather
// than lying as one smooth sheet. The waves that count are those of the cascade after
// the ones that make foam: longer ones would take a whitecap away whole in each trough.
// And it shows far more than the squeeze alone: a thin film of foam is all but clear, a
// thick one white. Far off, where the mips have averaged those waves away, a whitecap
// is as the cascades have it.
//
// That cascade makes no foam, and holds its squeeze where the others hold theirs,
// averaged over its last frames (fftShaders.ts), so it comes with the slopes and costs
// nothing to read. Averaged, the gaps in a whitecap are several pixels across and soft
// at the edge; as the squeeze stands in any one frame they are a pixel each, and a
// whitecap looks made of pixels.
// How far the slopes of a wind-roughened ocean spread, about, as Cox and Munk measured
// for this wind, and the mip of the baked Milky Way the water mirrors: its blurriest.
const MIRROR_SLOPE = 0.22;
const MIRROR_BLUR = 5.0;
const LACE_CASCADE = ${LACE_CASCADE}u;
const LACE = 50.0;

@group(0) @binding(1) var displacement: texture_2d_array<f32>;
@group(0) @binding(2) var slopes: texture_2d_array<f32>;
@group(0) @binding(3) var waves: sampler;
@group(0) @binding(4) var ripples: texture_2d_array<f32>;

struct Surface {
  @builtin(position) position: vec4f,
  // Where the water at this pixel came from, before the waves moved it: the cascades
  // are indexed by that.
  @location(0) rest: vec2f,
  @location(1) world: vec3f,
  // The clouds the water mirrors, as cloudsIn gives them.
  @location(2) clouds: vec4f,
  // How much of the sun, and of what lights the ocean directly, lies behind cloud: the same
  // for the whole ocean.
  @location(3) @interpolate(flat) clouded: vec2f,
  // The Milky Way as the water mirrors it, before the low air it is seen through, and as
  // it glows over the far water: each looked up once a vertex, as the clouds are.
  @location(4) galaxy: vec3f,
  @location(5) glow: vec3f,
}

@vertex
fn surfaceVertex(@location(0) tile: vec3f, @builtin(vertex_index) index: u32) -> Surface {
  let grid = vec2u(index % SIDE, index / SIDE);
  let spacing = tile.z;
  var rest = tile.xy + vec2f(grid) * spacing;

  // Odd vertices slide onto their even neighbours towards the end of a level's reach.
  let reach = REACH * spacing;
  let morph = saturate((length(rest) - MORPH_START * reach) / ((1.0 - MORPH_START) * reach));
  rest -= vec2f(grid % vec2u(2u)) * spacing * morph;
  let spaced = spacing * (1.0 + morph);

  var moved = vec3f(0.0);
  for (var i = 0u; i < CASCADES; i++) {
    let cascade = scene.cascades[i];
    // Waves far shorter than the mesh can only alias.
    let shown = 1.0 - saturate((spaced - cascade.shortest) / (cascade.shortest * 3.0));
    if (shown > 0.0) {
      let uv = rest * cascade.perSize;
      moved += textureSampleLevel(displacement, waves, uv, i, 0.0).xyz * shown;
    }
  }

  let world = vec3f(rest.x + moved.x, moved.y, rest.y + moved.z);
  let v = normalize(scene.eyeTime.xyz - world);
  return Surface(clipOf(world), rest, world, mirroredClouds(world), lampsClouded(), mirroredGalaxy(v), milkyWay(-v));
}

// The Milky Way as the water at a vertex mirrors it, seen from the way v. Rough water is
// no mirror: each facet shows a different part of the sky, and what the eye sees is the
// sky blurred over all their slopes. So it is looked up for a level facet and for two
// tilted towards the view and away, as far as the waves' slopes spread, each no sharper
// than the texture's blurriest mip, and averaged: tilted that way a facet shows sky
// higher or lower, which is most of the blur, and each look-up costs every vertex. With
// only the level one the water shows a patch of glow, as a calm sea would. What is left
// is a glow with no detail finer than the mesh, which is why it can be worked out here
// rather than for every pixel, where finding a way's place in the galaxy was a tenth
// of a night's frame.
fn mirroredGalaxy(v: vec3f) -> vec3f {
  return (galaxyIn(v, vec2f(0.0)) + galaxyIn(v, vec2f(0.0, MIRROR_SLOPE)) + galaxyIn(v, vec2f(0.0, -MIRROR_SLOPE))) / 3.0;
}

// The Milky Way in the way a facet of this slope mirrors to an eye in the way v.
fn galaxyIn(v: vec3f, slope: vec2f) -> vec3f {
  let r = reflect(-v, normalize(vec3f(-slope.x, 1.0, -slope.y)));
  return milkyWayBlurred(vec3f(r.x, abs(r.y), r.z), MIRROR_BLUR);
}

// How much of the sun lies behind cloud, then of what lights the ocean directly (lamp), as
// the sky shows them, read from the clouds' texture where they are each on the screen.
fn lampsClouded() -> vec2f {
  let sun = cloudsIn(scene.sun.xyz, LAMP_CLOUD_BLUR).a;
  var lamp = sun;
  if (scene.sun.y <= 0.0) {
    lamp = cloudsIn(scene.moon.xyz, LAMP_CLOUD_BLUR).a;
  }
  return vec2f(sun, lamp);
}

// The clouds the ocean mirrors at this place, looked up once a vertex, which are a few
// pixels apart: in the fragment shader the same look-up costs the whole ocean far more.
fn mirroredClouds(world: vec3f) -> vec4f {
  let v = normalize(scene.eyeTime.xyz - world);
  let mirror = vec3f(-v.x, abs(v.y), -v.z);
  // By day, from as soon as the sun is up to its being a little way up.
  let day = smoothstep(-0.02, 0.1, scene.sun.w);
  let blur = mix(CLOUD_BLUR_NIGHT, CLOUD_BLUR_DAY, day);
  return cloudsIn(normalize(mirror + vec3f(0.0, CLOUD_LIFT * (2.0 - v.y), 0.0)), blur) * mix(CLOUD_MIRROR_NIGHT, CLOUD_MIRROR_DAY, day);
}

// What the masking and shadowing of a rough surface takes away (Smith's).
fn masking(cosine: f32, variance: f32) -> f32 {
  let v = cosine / sqrt(max(1.0 - cosine * cosine, 1e-6) * 2.0 * variance);
  return max(0.0, (exp(-v * v) - v * sqrt(PI) * (1.0 - erfApprox(v))) / (2.0 * v * sqrt(PI)));
}

fn erfApprox(x: f32) -> f32 {
  let t = 1.0 / (1.0 + 0.47047 * abs(x));
  let e = 1.0 - t * (0.3480242 + t * (-0.0958798 + t * 0.7478556)) * exp(-x * x);
  return e * sign(x);
}

struct Lamp {
  // The way to it.
  direction: vec3f,
  radiance: vec3f,
}

// How much of the moon's light makes glints. The ocean is lit for a long exposure, and
// the moon's path would burn out to a white block; the eye sees it as sparkles.
const MOON_GLINT = 0.45;

// What lights the ocean directly: the sun while it is up, then the moon. Both fade
// out as they meet the horizon, so neither gives way to the other all at once.
fn lamp() -> Lamp {
  if (scene.sun.y > 0.0) {
    return Lamp(scene.sun.xyz, sunlight() * smoothstep(0.0, 0.03, scene.sun.y));
  }
  return Lamp(scene.moon.xyz, moonlight() * MOON_GLINT * smoothstep(0.0, 0.03, scene.moon.y));
}

// A light on a surface with these slopes, by an anisotropic Gaussian of its
// remaining roughness: the Ross, Dion and Potvin model of a wind-roughened ocean.
fn glint(n: vec3f, v: vec3f, l: vec3f, tx: vec3f, ty: vec3f, variance: vec2f) -> f32 {
  let h = normalize(l + v);
  let zh = max(dot(h, n), 0.01);
  let zv = max(dot(v, n), 0.01);
  let zl = max(dot(l, n), 0.01);
  let ax = dot(h, tx) / zh;
  let ay = dot(h, ty) / zh;
  let exponent = -0.5 * (ax * ax / variance.x + ay * ay / variance.y);
  let peak = exp(exponent) / (2.0 * PI * sqrt(variance.x * variance.y));
  let aimed = dot(v, tx) * dot(v, tx) / max(1.0 - zv * zv, 1e-5);
  let viewVariance = mix(variance.y, variance.x, saturate(aimed));
  let lit = dot(l, tx) * dot(l, tx) / max(1.0 - zl * zl, 1e-5);
  let lightVariance = mix(variance.y, variance.x, saturate(lit));
  let fresnel = REFLECTANCE + (1.0 - REFLECTANCE) * pow(1.0 - saturate(dot(v, h)), 5.0);
  let shared_ = 1.0 + masking(zl, lightVariance) + masking(zv, viewVariance);
  return fresnel * peak / (shared_ * 4.0 * zv * zh * zh * zh * zh);
}

// The reflectance of a rough ocean, averaged over its slopes: rougher water reflects
// less at a grazing angle, as it turns more of itself towards the eye.
fn meanFresnel(cosine: f32, variance: f32) -> f32 {
  let sigma = sqrt(variance);
  let curve = pow(1.0 - cosine, 5.0 * exp(-2.69 * sigma)) / (1.0 + 22.7 * pow(sigma, 1.5));
  return REFLECTANCE + (1.0 - REFLECTANCE) * curve;
}

@fragment
fn surfaceFragment(surface: Surface) -> @location(0) vec4f {
  let rest = surface.rest;
  let dx = dpdx(rest);
  let dy = dpdy(rest);
  let major = sqrt(max(dot(dx, dx), dot(dy, dy)));
  let minor = sqrt(min(dot(dx, dx), dot(dy, dy)));
  // Anisotropic filtering takes it this far down the mips before it is a blur.
  let footprint = max(minor, major / 8.0);

  var slope = vec2f(0.0);
  var stretch = 0.0;
  var foam = 0.0;
  // How far the short waves have drawn the surface together here, which foam bunches by.
  var drawn = 0.0;
  for (var i = 0u; i < CASCADES; i++) {
    let cascade = scene.cascades[i];
    // Waves averaged away altogether, which unresolved() has accounted for.
    if (footprint < cascade.size * 0.5) {
      let texel = textureSampleGrad(
        slopes, waves, rest * cascade.perSize, i, dx * cascade.perSize, dy * cascade.perSize
      );
      slope += texel.xy;
      stretch += texel.z;
      // One cascade holds the squeeze where the rest hold foam. Chosen without a branch:
      // with one here the loop is no longer unrolled, and the whole surface costs a
      // tenth more.
      drawn += select(0.0, texel.w, i == LACE_CASCADE);
      foam += select(texel.w, 0.0, i == LACE_CASCADE);
    }
  }
  // The waves' own foam, bunched and thinned by the short ones: not what rain throws up.
  foam *= max(1.0 + LACE * drawn, 0.0);

  let rain = scene.wind.w;
  if (rain > 0.0) {
    let fine = textureSampleGrad(ripples, waves, rest / RIPPLE_TILE, 0, dx / RIPPLE_TILE, dy / RIPPLE_TILE);
    let scale = 1.0 / (RIPPLE_TILE * RIPPLE_LARGER);
    let wide = textureSampleGrad(
      ripples, waves, vec2f(-rest.y, rest.x) * scale, 0, vec2f(-dx.y, dx.x) * scale, vec2f(-dy.y, dy.x) * scale
    );
    slope += (fine.xy + vec2f(wide.y, -wide.x) * RIPPLE_LARGER_SLOPE) * rain;
    foam += fine.w * rain;
  }

  // Slopes are by the water's rest position, which the waves have squeezed or spread.
  slope /= max(1.0 + stretch, 0.25);
  let n = normalize(vec3f(-slope.x, 1.0, -slope.y));

  let toEye = scene.eyeTime.xyz - surface.world;
  let distance = length(toEye);
  let v = toEye / distance;
  let light = lamp();
  let l = light.direction;

  let along = vec3f(scene.wind.x, 0.0, scene.wind.y);
  let tx = normalize(along - n * dot(along, n));
  let ty = cross(n, tx);

  // Near the camera, sharp points of light are the look wanted, not smooth physics.
  let settled = smoothstep(4.0, 400.0, distance);
  let hidden = unresolved(footprint) + RAIN_VARIANCE * rain * saturate(footprint / RAIN_VARIANCE_FOOTPRINT);
  let variance = hidden * mix(NEAR_ROUGHNESS, 1.0, settled) + DISC_VARIANCE;

  let viewCosine = saturate(dot(v, n));
  let fresnel = meanFresnel(viewCosine, variance.x + variance.y);
  // Unseen waves don't only blur the reflection. Of all their facets, those turned
  // towards the eye are seen most, and those reflect sky higher than the mirror
  // direction: a rough ocean looks bluer than the horizon it would otherwise mirror.
  let roughness = sqrt(hidden.x + hidden.y);
  let r = normalize(reflect(-v, n) + vec3f(0.0, roughness * (2.0 - viewCosine), 0.0));
  let up = vec3f(r.x, abs(r.y), r.z);
  // The clouds lie in front of the sky they mirror, as they do overhead.
  let cloud = surface.clouds;
  // The Milky Way comes from the vertices; the low air it is seen through goes by the
  // way each pixel mirrors, so the waves still show in it.
  let sky = (skyRadiance(up) + surface.galaxy * mirroredAir(up.y) * cloudCover()) * (1.0 - cloud.a) + cloud.rgb;

  // Light scattered back up out of the water, more of it the higher the real sun.
  let overhead = scene.overhead.rgb;
  let lit = sunlight() * saturate(scene.sun.w + 0.25) + moonlight() * 0.3 + overhead * 2.0;
  let height = saturate(surface.world.y * 0.45 + 0.15);
  let behind = pow(saturate(dot(-v, normalize(vec3f(l.x, 0.05, l.z))) * 0.5 + 0.5), 3.0);
  let clearWater = DEEP * lit + THROUGH_CREST * lit * height * height * (0.12 + behind * 0.5);
  let water = mix(clearWater, vec3f(dot(clearWater, vec3f(0.3, 0.5, 0.2))), rain * RAIN_GREY) * mix(1.0, RAIN_DARK, rain);

  // The glints are of the lamp's disc, which cloud in front of it dims as it does the disc
  // in the sky: more than it does the sky, as a beam.
  let through = (1.0 - surface.clouded.y) * (1.0 - surface.clouded.y);
  var color = water * (1.0 - fresnel) + sky * fresnel + light.radiance * through * glint(n, v, l, tx, ty, variance);

  // Whitecaps, lit by all there is.
  let whitecap = saturate(foam);
  if (whitecap > 0.0) {
    let diffuse = (sunlight() * saturate(scene.sun.w) + moonlight() * 0.3 + overhead * PI * 1.3) * 0.28;
    color = mix(color, diffuse, whitecap);
  }

  // Haze, thickening with distance, and into the very colour of the sky on the
  // horizon, so that no line is left where the two meet. Over it lies the glow of the
  // Milky Way, which reaches the horizon and blurs on down over the far water, fading
  // as it goes (starHaze): as bright on the horizon as the sky just above it.
  let flatView = normalize(vec3f(-v.x, 0.0, -v.z));
  let hazed = 1.0 - exp(-distance / mix(HAZE_DISTANCE, RAIN_HAZE_DISTANCE, rain));
  let meeting = 1.0 - smoothstep(0.0, HORIZON_SOFTNESS, v.y);
  let haze = 1.0 - (1.0 - hazed) * (1.0 - meeting);
  // The camera's glare goes with as much of the sun as cloud hides, as it does over the sky.
  color = mix(color, skyRadiance(flatView) + sunGlare(flatView) * (1.0 - surface.clouded.x), haze) + surface.glow * cloudCover();

  return vec4f(display(color, surface.position.xy), 1.0);
}
`
