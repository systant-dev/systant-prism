// What the ocean is made of, as numbers the GPU can animate: for each of six
// cascades, the amplitude and frequency of every wave its 256×256 patch can
// hold. Nothing here touches a GPU, so all of it can be tested.
//
// Wind waves follow the fetch-limited JONSWAP spectrum: how much energy each
// frequency holds, for a wind that has blown over so much water. Donelan and
// Banner's spreading says which way it goes: narrowly around the wind at the
// peak of the spectrum, and more widely either side of it. A swell, come from
// a storm far away, is laid over it: the same shape, narrowed, about one
// heading, which is what makes its crests long.
//
// Waves take their speed from the dispersion relation, deep water's with the
// capillary term, which is what holds the shortest ripples up rather than gravity.
//
// The patches overlap, as a patch of size L holds wavelengths from L down to
// L/128. Each wave belongs to one cascade alone, or the overlap would count it
// twice: the one that holds it with six or more cycles across the next patch
// hands it on to that patch, where it is well sampled.
//
// Every frequency is rounded to a whole number of cycles in LOOP_SECONDS, so
// that the ocean repeats exactly and the time the shaders are given can wrap,
// before a float's precision runs out on the fastest waves.

import { mulberry32 } from '../sky'

export const GRAVITY = 9.81

/** Water's surface tension over its density, in m³/s². */
export const CAPILLARITY = 7.4e-5

/** The samples along each side of a cascade. */
export const CASCADE_SAMPLES = 256

/** How many cascades there are. */
export const CASCADES = 6

/** The largest patch's side and the smallest's, in metres. */
const LARGEST_PATCH = 1103
const SMALLEST_PATCH = 0.26

/** The side of each cascade's patch, in metres, largest first. */
export const CASCADE_SIZES = Array.from(
  { length: CASCADES },
  (_, i) => LARGEST_PATCH * (SMALLEST_PATCH / LARGEST_PATCH) ** (i / (CASCADES - 1)),
)

/** How many cycles across a patch a wave must make for that patch to take it over from the one before. */
const HANDOVER_CYCLES = 6

/**
 * How many waves each way from the longest a cascade holds, and how many that is along a
 * side, for all but the last, which takes what is left and so holds them all. It hands its
 * short waves on to the next, so most of its patch is empty.
 */
export const BAND = Math.ceil((HANDOVER_CYCLES * CASCADE_SIZES[0]) / CASCADE_SIZES[1]) - 1
export const BAND_SAMPLES = 2 * BAND + 1

/** How many waves are kept, over all the cascades. */
export const KEPT_WAVES = (CASCADES - 1) * BAND_SAMPLES * BAND_SAMPLES + CASCADE_SAMPLES * CASCADE_SAMPLES

/** Which row or column of a cascade's band an index in FFT order is, or BAND_SAMPLES and up if it is outside it. */
export function inBand(index: number) {
  return (index + BAND) % CASCADE_SAMPLES
}

/** How long the ocean takes to repeat, in seconds. */
export const LOOP_SECONDS = 512

/** The peak enhancement of wind waves, and of a swell, which is narrower. */
const WIND_WAVE_PEAK = 3.3
const SWELL_PEAK = 7

export interface Swell {
  /** Its significant wave height, in metres. */
  height: number
  /** Its peak period, in seconds. */
  period: number
  /** The way it travels, in radians from +x towards +z. */
  heading: number
  /** How far its crests fan out either side of its heading, in radians (a standard deviation). */
  spread: number
}

export interface Ocean {
  /** The wind 10 m above the water, in m/s. */
  wind: number
  /** How far the wind has blown over open water, in metres. */
  fetch: number
  /** The way the wind blows, in radians from +x towards +z. */
  heading: number
  swell: Swell
}

/** The frequency of a wave of wavenumber `k`, in radians per second. */
export function angularFrequency(k: number) {
  return Math.sqrt(GRAVITY * k + CAPILLARITY * k * k * k)
}

/** How fast a wave of wavenumber `k` carries its energy: dω/dk, in m/s. */
export function groupVelocity(k: number) {
  return (GRAVITY + 3 * CAPILLARITY * k * k) / (2 * angularFrequency(k))
}

/** Hasselmann's scale of an ocean with this wind and fetch, and its peak frequency. */
export function fetchLimited(wind: number, fetch: number) {
  return {
    scale: 0.076 * ((wind * wind) / (fetch * GRAVITY)) ** 0.22,
    peak: 22 * ((GRAVITY * GRAVITY) / (wind * fetch)) ** (1 / 3),
  }
}

/** The JONSWAP spectrum: how much variance a frequency holds, in m²s. */
export function jonswap(omega: number, scale: number, peak: number, enhancement: number) {
  const ratio = peak / omega
  const width = omega <= peak ? 0.07 : 0.09
  const offset = (omega - peak) / (width * peak)
  return (
    ((scale * GRAVITY * GRAVITY) / omega ** 5) *
    Math.exp(-1.25 * ratio ** 4) *
    enhancement ** Math.exp(-0.5 * offset * offset)
  )
}

/**
 * Donelan and Banner's spreading: how the energy of a wave `ratio` times the
 * peak's frequency lies at `angle` from the wind. Over all angles it comes to 1.
 */
export function donelanBanner(ratio: number, angle: number) {
  // They measured nothing below 0.56, so what is below takes its width from there.
  const r = Math.max(ratio, 0.56)
  let beta: number
  if (r < 0.95) beta = 2.61 * r ** 1.3
  else if (r < 1.6) beta = 2.28 * r ** -1.3
  else beta = 10 ** (-0.4 + 0.8393 * Math.exp(-0.567 * Math.log(r * r)))
  const sech = 1 / Math.cosh(beta * angle)
  return (beta / (2 * Math.tanh(beta * Math.PI))) * sech * sech
}

/** A narrow bell about the swell's heading. Over all angles it comes to 1. */
function swellSpreading(angle: number, spread: number) {
  return Math.exp((-0.5 * angle * angle) / (spread * spread)) / (Math.sqrt(2 * Math.PI) * spread)
}

/** An angle brought into −π to π. */
function wrapAngle(angle: number) {
  return angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI))
}

/** How much variance a whole JONSWAP spectrum of scale 1 holds. */
function unitVariance(peak: number, enhancement: number) {
  let total = 0
  const step = peak / 400
  for (let omega = step; omega < peak * 12; omega += step) total += jonswap(omega, 1, peak, enhancement) * step
  return total
}

export interface OceanModel {
  /** The energy of waves of wavenumber `k` heading at `heading`, per unit of k and per radian, in m³. */
  polar(k: number, heading: number): number
}

/** The ocean, ready to be read: its wind waves and swell, each at their measure. */
export function oceanModel({ wind, fetch, heading, swell }: Ocean): OceanModel {
  const ocean = fetchLimited(wind, fetch)
  const swellPeak = (2 * Math.PI) / swell.period
  const swellScale = (swell.height * swell.height) / 16 / unitVariance(swellPeak, SWELL_PEAK)
  return {
    polar(k, direction) {
      const omega = angularFrequency(k)
      const windy =
        jonswap(omega, ocean.scale, ocean.peak, WIND_WAVE_PEAK) *
        donelanBanner(omega / ocean.peak, wrapAngle(direction - heading))
      const swollen =
        jonswap(omega, swellScale, swellPeak, SWELL_PEAK) *
        swellSpreading(wrapAngle(direction - swell.heading), swell.spread)
      return (windy + swollen) * groupVelocity(k)
    },
  }
}

/** The wavenumbers cascade `index` holds: from the first to just short of the second. */
export function cascadeBand(index: number): [number, number] {
  const handover = (i: number) => (HANDOVER_CYCLES * 2 * Math.PI) / CASCADE_SIZES[i]
  return [index === 0 ? 0 : handover(index), index === CASCADES - 1 ? Infinity : handover(index + 1)]
}

/** How many values cascadeSpectrum gives per wave. */
export const SPECTRUM_STRIDE = 4

/**
 * Every wave of cascade `index`, row by row, in FFT order (frequency 0 first):
 * the real and imaginary parts of its amplitude when time is 0, its frequency,
 * and 1/k, or 0 for a wave it doesn't hold.
 *
 * With `h(k, t) = h0(k) e^(−iωt) + conj(h0(−k)) e^(iωt)` the sum of `h(k, t) e^(ik·x)`
 * over the patch is the height of the ocean at x, with no scale to apply.
 */
export function cascadeSpectrum(ocean: Ocean, index: number): Float32Array<ArrayBuffer> {
  const making = cascadeSpectrumInSteps(ocean, index)
  let step = making.next()
  while (!step.done) step = making.next()
  return step.value
}

/**
 * As cascadeSpectrum, a row at a time, for the page to paint between them: the last
 * cascade holds every wave of its patch, and is tens of ms of work in one go.
 */
export function* cascadeSpectrumInSteps(ocean: Ocean, index: number): Generator<void, Float32Array<ArrayBuffer>> {
  const model = oceanModel(ocean)
  const samples = CASCADE_SAMPLES
  const out = new Float32Array(samples * samples * SPECTRUM_STRIDE)
  const step = (2 * Math.PI) / CASCADE_SIZES[index]
  const [low, high] = cascadeBand(index)
  const random = mulberry32(index * 7919 + 1)
  const loop = (2 * Math.PI) / LOOP_SECONDS

  for (let y = 0; y < samples; y++) {
    const kz = (y <= samples / 2 ? y : y - samples) * step
    for (let x = 0; x < samples; x++) {
      const kx = (x <= samples / 2 ? x : x - samples) * step
      const at = (y * samples + x) * SPECTRUM_STRIDE
      // Two Gaussians for every wave, used or not, so a band's edge moves no other wave.
      const radius = Math.sqrt(-2 * Math.log(1 - random()))
      const turn = 2 * Math.PI * random()
      const k = Math.hypot(kx, kz)
      // A wave at the Nyquist frequency has no opposite to keep the ocean real.
      if (k === 0 || k < low || k >= high || x === samples / 2 || y === samples / 2) continue
      // Per unit of area of k: a ring of radius k holds k times what a line across it does.
      const energy = model.polar(k, Math.atan2(kz, kx)) / k
      // Half the wave's variance for this one and half for its opposite.
      const amplitude = Math.sqrt((energy * step * step) / 2)
      out[at] = amplitude * radius * Math.SQRT1_2 * Math.cos(turn)
      out[at + 1] = amplitude * radius * Math.SQRT1_2 * Math.sin(turn)
      out[at + 2] = Math.round(angularFrequency(k) / loop) * loop
      out[at + 3] = 1 / k
    }
    yield
  }
  return out
}

/** The waves of cascade `index` that are kept: its band, or all of the last cascade's. */
export function keptSpectrum(waves: Float32Array<ArrayBuffer>, index: number): Float32Array<ArrayBuffer> {
  if (index === CASCADES - 1) return waves
  const out = new Float32Array(BAND_SAMPLES * BAND_SAMPLES * SPECTRUM_STRIDE)
  for (let y = 0; y < CASCADE_SAMPLES; y++) {
    const row = inBand(y)
    if (row >= BAND_SAMPLES) continue
    for (let x = 0; x < CASCADE_SAMPLES; x++) {
      const column = inBand(x)
      if (column >= BAND_SAMPLES) continue
      const from = (y * CASCADE_SAMPLES + x) * SPECTRUM_STRIDE
      out.set(waves.subarray(from, from + SPECTRUM_STRIDE), (row * BAND_SAMPLES + column) * SPECTRUM_STRIDE)
    }
  }
  return out
}

/** The shortest wave the ocean holds, in metres. */
const SHORTEST_WAVE = 2e-3

/** How many entries of slopeVariances there are, an octave of wavelength apart. */
export const SLOPE_ENTRIES = 24

export interface OceanStatistics {
  /** Four times the standard deviation of the height, in metres. */
  significantHeight: number
  /**
   * The variance of the slopes of the waves shorter than `SHORTEST_WAVE × 2^i` at
   * entry `i`, along the wind and across it, in pairs. A pixel can't show waves
   * much shorter than itself, so this is the roughness it must make up for them.
   */
  slopeVariances: Float32Array<ArrayBuffer>
}

/** Integrates the ocean over every wave, in steps of wavenumber and heading. */
export function oceanStatistics(ocean: Ocean): OceanStatistics {
  const model = oceanModel(ocean)
  const stepsPerOctave = 12
  const headings = 96
  let heightVariance = 0
  const slopes = new Float32Array(SLOPE_ENTRIES * 2)
  let along = 0
  let across = 0
  const turn = (2 * Math.PI) / headings
  // Up from the shortest wave, so each entry is the sum so far, and the first is nothing.
  for (let entry = 1; entry < SLOPE_ENTRIES; entry++) {
    const shortest = SHORTEST_WAVE * 2 ** (entry - 1)
    for (let s = 0; s < stepsPerOctave; s++) {
      const wavelength = shortest * 2 ** ((s + 0.5) / stepsPerOctave)
      const k = (2 * Math.PI) / wavelength
      const width = k * (2 ** (0.5 / stepsPerOctave) - 2 ** (-0.5 / stepsPerOctave))
      for (let h = 0; h < headings; h++) {
        const heading = (h + 0.5) * turn - Math.PI
        const energy = model.polar(k, heading) * width * turn
        const relative = heading - ocean.heading
        heightVariance += energy
        along += energy * (k * Math.cos(relative)) ** 2
        across += energy * (k * Math.sin(relative)) ** 2
      }
    }
    slopes[entry * 2] = along
    slopes[entry * 2 + 1] = across
  }
  return { significantHeight: 4 * Math.sqrt(heightVariance), slopeVariances: slopes }
}
