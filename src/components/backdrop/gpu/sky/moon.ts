// The face of the moon, drawn from what is really there rather than from a picture
// of it: a library shouldn't carry a photograph, and this costs nothing outside
// the few thousand pixels of the disc.
//
// The dark maria and the bright rayed craters are at their true selenographic
// coordinates, and what the eye sees of them comes from laying them on a sphere, so
// those near the edge foreshorten as they should. The edges of the maria are broken
// up by noise, as the ones on the map are round and the real ones are not. A full
// moon has almost no darkening towards its limb, unlike the sun, so it has none here.

/** A mare: latitude and longitude in degrees, and its radius as an angle, in radians. */
export const MARIA: [number, number, number][] = [
  [33, -16, 0.38], // Imbrium
  [28, 17, 0.24], // Serenitatis
  [8.5, 31, 0.29], // Tranquillitatis
  [17, 59, 0.16], // Crisium
  [-6, 51, 0.25], // Fecunditatis
  [-15, 35, 0.12], // Nectaris
  [-21, -17, 0.25], // Nubium
  [-24, -39, 0.15], // Humorum
  [13, 4, 0.12], // Vaporum
  [-8, -23, 0.2], // Cognitum
  [7, -31, 0.22], // Insularum
  [28, -55, 0.36], // Procellarum, in the north
  [6, -52, 0.32], // and in the south
  [58, -30, 0.12], // Frigoris, a long band across the north
  [59, 0, 0.1],
  [56, 28, 0.09],
]

/** A bright young crater: latitude, longitude, how far its rays reach, how many, and how bright they are. */
export const CRATERS: [number, number, number, number, number][] = [
  [-43, -11, 1.7, 13, 0.34], // Tycho
  [10, -20, 5.5, 9, 0.3], // Copernicus
  [8, -38, 9, 7, 0.22], // Kepler
  [24, -47, 22, 0, 0.42], // Aristarchus, the brightest spot on the moon
  [16, 47, 14, 6, 0.18], // Proclus
]

/** The way to a point on the moon, from its centre: +x east, +y north, and +z towards the Earth. */
export function moonPoint(latitude: number, longitude: number): [number, number, number] {
  const north = (latitude * Math.PI) / 180
  const east = (longitude * Math.PI) / 180
  return [Math.cos(north) * Math.sin(east), Math.sin(north), Math.cos(north) * Math.cos(east)]
}

const vec3 = (values: number[]) => `vec3f(${values.map((v) => v.toFixed(5)).join(', ')})`

/** Smooth noise, for the moon's surface, the Milky Way's clouds and the forest's wind. */
export const noiseSource = /* wgsl */ `
fn moonHash(cell: vec3f) -> f32 {
  let p = vec3u(vec3i(cell) + vec3i(4096));
  var n = (p.x * 73856093u) ^ (p.y * 19349663u) ^ (p.z * 83492791u);
  n = (n ^ (n >> 13u)) * 1274126177u;
  return f32(n ^ (n >> 16u)) / 4294967295.0;
}

fn moonNoise(p: vec3f) -> f32 {
  let cell = floor(p);
  let f = p - cell;
  let u = f * f * (3.0 - 2.0 * f);
  let low = mix(
    mix(moonHash(cell), moonHash(cell + vec3f(1.0, 0.0, 0.0)), u.x),
    mix(moonHash(cell + vec3f(0.0, 1.0, 0.0)), moonHash(cell + vec3f(1.0, 1.0, 0.0)), u.x),
    u.y
  );
  let high = mix(
    mix(moonHash(cell + vec3f(0.0, 0.0, 1.0)), moonHash(cell + vec3f(1.0, 0.0, 1.0)), u.x),
    mix(moonHash(cell + vec3f(0.0, 1.0, 1.0)), moonHash(cell + vec3f(1.0, 1.0, 1.0)), u.x),
    u.y
  );
  return mix(low, high, u.z);
}

fn moonOctaves(p: vec3f) -> f32 {
  return moonNoise(p) * 0.5 + moonNoise(p * 2.03) * 0.28 + moonNoise(p * 4.1) * 0.15 + moonNoise(p * 8.2) * 0.07;
}
`

/** Made by a function so that a bundle without the ocean can leave the tables behind. */
function moonShader() {
  return /* wgsl */ `
const MARIA = array<vec4f, ${MARIA.length}>(
  ${MARIA.map(([latitude, longitude, radius]) => `vec4f(${vec3(moonPoint(latitude, longitude))}, ${radius})`).join(',\n  ')}
);

// Where each is, then how far its rays reach, how many, and how bright.
const CRATERS = array<array<vec3f, 2>, ${CRATERS.length}>(
  ${CRATERS.map(
    ([latitude, longitude, falloff, rays, bright]) =>
      `array<vec3f, 2>(${vec3(moonPoint(latitude, longitude))}, ${vec3([falloff, rays, bright])})`,
  ).join(',\n  ')}
);

${noiseSource}

// A crater's bright spot, and the rays that spread from it.
fn craterLight(q: vec3f, crater: array<vec3f, 2>) -> f32 {
  let centre = crater[0];
  let falloff = crater[1].x;
  let rays = crater[1].y;
  let across = q - centre;
  let away = length(across);
  let spot = exp(-away * away * 900.0);
  if (rays == 0.0) {
    return crater[1].z * spot;
  }
  let east = normalize(cross(vec3f(0.0, 1.0, 0.0), centre));
  let angle = atan2(dot(across, cross(centre, east)), dot(across, east));
  // Uneven, as ejecta lies: some rays long and bright, others barely there.
  let unevenly = sin(angle * rays + 2.4 * sin(angle * 3.0) + 1.4 * sin(angle * 7.0 + 1.0));
  let strength = 0.35 + 0.65 * moonNoise(vec3f(cos(angle), sin(angle), 0.0) * 3.0 + centre * 9.0);
  let streak = pow(0.5 + 0.5 * unevenly, 5.0) * strength;
  // Each thins out in patches along its length.
  let patchy = 0.45 + 0.8 * moonOctaves(q * 16.0);
  return crater[1].z * (spot + streak * patchy * exp(-away * falloff) * smoothstep(0.02, 0.1, away));
}

// How bright the moon's surface is at q, a point on the unit sphere: about 1 in the
// highlands, and about half that in the maria, as in fact they are.
fn moonSurface(q: vec3f) -> f32 {
  // Pushed about by noise, so that the maria have coasts rather than circles.
  let bent = q + (vec3f(moonOctaves(q * 2.3), moonOctaves(q * 2.3 + 7.0), moonOctaves(q * 2.3 + 13.0)) - 0.5) * 0.34;
  // Each adds to the last, so that the maria run together into one dark plain.
  var land = 1.0;
  for (var i = 0; i < ${MARIA.length}; i++) {
    let each = MARIA[i];
    land *= 1.0 - smoothstep(each.w * 1.28, each.w * 0.7, length(bent - each.xyz));
  }
  let mare = 1.0 - land;
  let mottled = moonOctaves(q * 7.0) * 0.7 + moonOctaves(q * 21.0) * 0.3;
  let highlands = 0.56 + 0.72 * mottled;
  let lowlands = 0.26 + 0.34 * moonOctaves(q * 4.0);
  var surface = mix(highlands, lowlands, mare);
  for (var i = 0; i < ${CRATERS.length}; i++) {
    surface += craterLight(q, CRATERS[i]);
  }
  return surface;
}
`
}

export const moonSource = /* @__PURE__ */ moonShader()
