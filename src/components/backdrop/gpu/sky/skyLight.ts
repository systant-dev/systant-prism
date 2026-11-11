// How much light there is, which goes by where the sun and moon are and how hard it is
// raining, and so is the same for every pixel of a frame. Worked out here, once, it costs
// next to nothing, where a shader would work it out afresh many times over for every
// pixel, as nothing can lift it out of a fragment shader. Nothing here touches a GPU, so
// all of it can be tested.
//
// skyLightSource (skyShaders.ts) takes its constants from here, and skyRadiance there is
// the same sum as `radiance` here: one has to change along with the other.

import { saturate } from './maths'

/** How many bytes the fields of skyFieldsSource take. */
export const SKY_UNIFORMS_SIZE = 16 * 13

/** Where each field of skyFieldsSource starts, in 32-bit floats. */
export const SKY_UNIFORM = {
  right: 0,
  up: 4,
  forward: 8,
  eye: 12,
  time: 15,
  sun: 16,
  moon: 20,
  wind: 24,
  moonTilt: 26,
  rain: 27,
  sunlit: 28,
  sunWide: 31,
  skylit: 32,
  sunTall: 35,
  moonlit: 36,
  moonWide: 39,
  clouded: 40,
  moonTall: 43,
  overhead: 44,
  lowSky: 48,
} as const

export const RAYLEIGH = [0.038, 0.098, 0.285]
export const MIE = 0.009
export const MIE_FORWARD = 0.86
export const MOON_FORWARD = 0.9
/** How much of the sky is left once the sun has gone, brighter towards the horizon. */
export const NIGHT_ZENITH = [0.006, 0.01, 0.026]
export const NIGHT_HORIZON = [0.016, 0.027, 0.056]
export const MOONLIGHT = [1.5, 1.74, 2.25]
/** The moon stays low, so its height counts for this many times as much, to leave it white once well up. */
export const MOON_HEIGHT = 5
/**
 * How much of the moon's light the sky scatters towards the eye, as a share of the
 * sun's. Less than all of it, or the stars would go, as they do for a camera.
 */
export const MOON_SKY = 0.7
/** How much of the light of the sun and moon comes straight through rain cloud. */
export const THROUGH_RAIN_CLOUD = 0.003

const SUN_IRRADIANCE = 20
/**
 * How bright the underside of rain cloud is, as a share of the light on its top, and
 * how much of its colour it keeps: the sky goes grey, with a little of the sunset left.
 */
const RAIN_CLOUD = 0.036
const RAIN_CLOUD_COLOUR = 0.25
const RAIN_CLOUD_TINT = [0.95, 1, 1.08]
/** How much of a full moon's light gets through, and how dark it is with no moon at all. */
const RAIN_CLOUD_MOON = 0.03
const RAIN_CLOUD_NIGHT = [0.004, 0.005, 0.008]

/** Low ahead, where a drop of rain looks at the sky through itself. */
const LOW_SKY = [0, 0.14 / Math.hypot(0.14, 1), 1 / Math.hypot(0.14, 1)]

const CHANNELS = [0, 1, 2]

const mix = (a: number, b: number, by: number) => a * (1 - by) + b * by

/** How much air a view this far above the horizon passes through, in atmospheres. */
function airMass(height: number) {
  const y = Math.max(height, 0)
  return 1 / (y + 0.025 * Math.exp(-11 * y))
}

function henyeyGreenstein(cosine: number, g: number) {
  const g2 = g * g
  return (1 - g2) / (4 * Math.PI * (1 + g2 - 2 * g * cosine) ** 1.5)
}

/** How much of each colour gets through this much air. */
function through(mass: number) {
  return CHANNELS.map((c) => Math.exp(-(RAYLEIGH[c] + MIE) * mass))
}

/** Sets the fields of the scene's uniforms that go by the sun, the moon and the rain, from those. */
export function lightSky(data: Float32Array) {
  const sun = data.subarray(SKY_UNIFORM.sun, SKY_UNIFORM.sun + 3)
  const moon = data.subarray(SKY_UNIFORM.moon, SKY_UNIFORM.moon + 3)
  const sunHeight = data[SKY_UNIFORM.sun + 3]
  const moonShown = data[SKY_UNIFORM.moon + 3]
  const rain = data[SKY_UNIFORM.rain]

  // How far the sun's light has gone with it, 6° below the horizon being none.
  const left = saturate((sunHeight + 0.1) / 0.1)
  const afterglow = left * left
  // How much the cloud lets by.
  const cover = mix(1, THROUGH_RAIN_CLOUD, rain)

  // Reddened by all the air on the way.
  const overCloud = through(airMass(sunHeight)).map((air) => SUN_IRRADIANCE * air * afterglow)
  const sunlit = overCloud.map((light) => light * cover)
  // The same as it reaches the sky, high up, through far less air: the sky stays blue
  // overhead at sunset, and only dims. Reddened as much as the sun's own, it would turn
  // a blue sky green.
  const dimmed = mix(0.16, 1, saturate(sunHeight / 0.3))
  const skylit = through(airMass(sunHeight) ** 0.34).map((air) => SUN_IRRADIANCE * air * afterglow * dimmed)
  const moonAir = through(airMass(moon[1] * MOON_HEIGHT))
  const moonlit = CHANNELS.map((c) => MOONLIGHT[c] * moonShown * moonAir[c] * cover)

  // The underside of rain cloud is lit by all that falls on its top, so it follows the
  // day and the moon, only greyer.
  const over = CHANNELS.map((c) => (overCloud[c] + skylit[c]) * 0.5)
  const grey = over[0] * 0.3 + over[1] * 0.5 + over[2] * 0.2
  const clouded = CHANNELS.map(
    (c) =>
      mix(grey, over[c], RAIN_CLOUD_COLOUR) * RAIN_CLOUD_TINT[c] * RAIN_CLOUD +
      MOONLIGHT[c] * moonShown * RAIN_CLOUD_MOON +
      RAIN_CLOUD_NIGHT[c],
  )

  /** The sky in direction `way`: skyRadiance in skyShaders.ts. */
  function radiance(way: readonly number[]) {
    const cosine = way[0] * sun[0] + way[1] * sun[1] + way[2] * sun[2]
    const phase = (3 / (16 * Math.PI)) * (1 + cosine * cosine)
    const hazy = henyeyGreenstein(cosine, MIE_FORWARD)
    const toMoon = way[0] * moon[0] + way[1] * moon[1] + way[2] * moon[2]
    const halo = henyeyGreenstein(toMoon, MOON_FORWARD) * 0.003
    const low = saturate(way[1] * 2.5) ** 0.6
    const mass = airMass(way[1]) ** 0.72
    return CHANNELS.map((c) => {
      const total = RAYLEIGH[c] + MIE
      const seen = 1 - Math.exp(-total * mass)
      const blue = ((skylit[c] * RAYLEIGH[c] * phase) / total) * seen * 1.25
      const glow = ((sunlit[c] * MIE * hazy) / total) * seen * 0.4
      const night = mix(NIGHT_HORIZON[c], NIGHT_ZENITH[c], low)
      const moonSky = ((MOONLIGHT[c] * moonShown * RAYLEIGH[c]) / total) * seen * MOON_SKY * (3 / (16 * Math.PI))
      const rainy = clouded[c] * (0.85 + 0.6 * saturate(way[1]))
      return mix(blue + glow + night + moonSky + moonlit[c] * halo, rainy, rain)
    })
  }

  data.set(sunlit, SKY_UNIFORM.sunlit)
  data.set(skylit, SKY_UNIFORM.skylit)
  data.set(moonlit, SKY_UNIFORM.moonlit)
  data.set(clouded, SKY_UNIFORM.clouded)
  data.set(radiance([0, 1, 0]), SKY_UNIFORM.overhead)
  data.set(radiance(LOW_SKY), SKY_UNIFORM.lowSky)
}
