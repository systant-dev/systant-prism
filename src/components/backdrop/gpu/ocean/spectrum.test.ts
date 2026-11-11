import { describe, expect, it } from 'vitest'
import {
  angularFrequency,
  BAND_SAMPLES,
  CAPILLARITY,
  CASCADE_SAMPLES,
  CASCADE_SIZES,
  cascadeBand,
  cascadeSpectrum,
  cascadeSpectrumInSteps,
  CASCADES,
  donelanBanner,
  fetchLimited,
  GRAVITY,
  groupVelocity,
  inBand,
  jonswap,
  KEPT_WAVES,
  keptSpectrum,
  LOOP_SECONDS,
  type Ocean,
  oceanModel,
  oceanStatistics,
  SLOPE_ENTRIES,
  SPECTRUM_STRIDE,
} from './spectrum'

const CALM_SWELL = { height: 1e-4, period: 10, heading: 0, spread: 0.1 }
const WIND_WAVES: Ocean = { wind: 8.5, fetch: 160_000, heading: -2.1, swell: CALM_SWELL }

/** The sum of `f` at `steps` points across a range. */
function integrate(from: number, to: number, f: (x: number) => number, steps = 20000) {
  const step = (to - from) / steps
  let sum = 0
  for (let i = 0; i < steps; i++) sum += f(from + (i + 0.5) * step) * step
  return sum
}

describe('dispersion', () => {
  it('is gravity waves for long waves and capillary waves for short ones', () => {
    expect(angularFrequency(0.1)).toBeCloseTo(Math.sqrt(GRAVITY * 0.1), 3)
    expect(angularFrequency(5000) / Math.sqrt(CAPILLARITY * 5000 ** 3)).toBeCloseTo(1, 2)
  })

  it('crosses over from one to the other where they are equal, at a wavelength of 1.7 cm', () => {
    const k = Math.sqrt(GRAVITY / CAPILLARITY)
    expect((2 * Math.PI) / k).toBeCloseTo(0.0172, 3)
  })

  it('carries energy at the slope of the frequency', () => {
    for (const k of [0.01, 1, 100, 3000]) {
      const h = k * 1e-5
      const slope = (angularFrequency(k + h) - angularFrequency(k - h)) / (2 * h)
      expect(groupVelocity(k)).toBeCloseTo(slope, 5)
    }
  })

  it('has long waves and capillary ripples both outrun what lies between them', () => {
    expect(groupVelocity(1)).toBeGreaterThan(groupVelocity(100))
    expect(groupVelocity(5000)).toBeGreaterThan(groupVelocity(100))
  })
})

describe('jonswap', () => {
  it('holds its peak at the peak frequency, higher than Pierson–Moskowitz by the enhancement', () => {
    const { scale, peak } = fetchLimited(10, 100_000)
    const sharp = jonswap(peak, scale, peak, 3.3)
    expect(sharp / jonswap(peak, scale, peak, 1)).toBeCloseTo(3.3, 5)
    expect(sharp).toBeGreaterThan(jonswap(peak * 0.9, scale, peak, 3.3))
    expect(sharp).toBeGreaterThan(jonswap(peak * 1.1, scale, peak, 3.3))
  })

  it('falls off as the fifth power of frequency in the tail', () => {
    const { scale, peak } = fetchLimited(10, 100_000)
    const ratio = jonswap(peak * 8, scale, peak, 3.3) / jonswap(peak * 16, scale, peak, 3.3)
    expect(ratio).toBeCloseTo(32, 1)
  })

  it('has longer, higher waves the longer the fetch', () => {
    const short = fetchLimited(10, 20_000)
    const long = fetchLimited(10, 200_000)
    expect(long.peak).toBeLessThan(short.peak)
    expect(long.scale).toBeLessThan(short.scale)
  })
})

describe('donelanBanner', () => {
  it.each([0.3, 0.56, 0.8, 1, 1.5, 2, 4, 10])('holds all the energy at %s times the peak frequency', (ratio) => {
    expect(integrate(-Math.PI, Math.PI, (angle) => donelanBanner(ratio, angle))).toBeCloseTo(1, 3)
  })

  it('is narrowest at the peak and spreads away from it', () => {
    const atPeak = donelanBanner(1, 0)
    expect(atPeak).toBeGreaterThan(donelanBanner(0.6, 0))
    expect(atPeak).toBeGreaterThan(donelanBanner(2, 0))
  })

  it('goes the way of the wind, evenly either side', () => {
    expect(donelanBanner(1.2, 0.4)).toBeCloseTo(donelanBanner(1.2, -0.4), 10)
    expect(donelanBanner(1.2, 0)).toBeGreaterThan(donelanBanner(1.2, 0.4))
  })
})

describe('seaStatistics', () => {
  it('finds the wave height of the JONSWAP spectrum it was given', () => {
    const { scale, peak } = fetchLimited(WIND_WAVES.wind, WIND_WAVES.fetch)
    const variance = integrate(peak * 0.2, peak * 30, (omega) => jonswap(omega, scale, peak, 3.3), 200000)
    expect(oceanStatistics(WIND_WAVES).significantHeight).toBeCloseTo(4 * Math.sqrt(variance), 1)
  })

  it('is near the fetch law for wave height, which that spectrum runs a little above', () => {
    const { wind, fetch } = WIND_WAVES
    const fetchLaw = (0.0016 * Math.sqrt((GRAVITY * fetch) / wind ** 2) * wind ** 2) / GRAVITY
    const ratio = oceanStatistics(WIND_WAVES).significantHeight / fetchLaw
    expect(ratio).toBeGreaterThan(1)
    expect(ratio).toBeLessThan(1.5)
  })

  it('adds a swell by the height it was given, independent waves adding by their variance', () => {
    const swell = { height: 1.2, period: 12, heading: 0, spread: 0.1 }
    const heights = oceanStatistics({ ...WIND_WAVES, swell }).significantHeight
    const windWaves = oceanStatistics(WIND_WAVES).significantHeight
    expect(heights).toBeCloseTo(Math.hypot(windWaves, 1.2), 1)
  })

  it('finds a slope variance near what Cox and Munk measured from sun glitter at this wind', () => {
    const { slopeVariances } = oceanStatistics(WIND_WAVES)
    const measured = 0.003 + 0.00512 * WIND_WAVES.wind
    const total = slopeVariances[(SLOPE_ENTRIES - 1) * 2] + slopeVariances[(SLOPE_ENTRIES - 1) * 2 + 1]
    expect(total / measured).toBeGreaterThan(0.5)
    expect(total / measured).toBeLessThan(1.5)
  })

  it('leaves more slope to the waves a wider pixel cannot show', () => {
    const { slopeVariances } = oceanStatistics(WIND_WAVES)
    expect(slopeVariances[0]).toBe(0)
    // Waves far longer than the peak of the spectrum add too little to count.
    for (let i = 1; i < 14; i++) {
      expect(slopeVariances[i * 2]).toBeGreaterThan(slopeVariances[(i - 1) * 2])
    }
  })

  it('is steeper along the wind than across it', () => {
    const { slopeVariances } = oceanStatistics(WIND_WAVES)
    expect(slopeVariances[(SLOPE_ENTRIES - 1) * 2]).toBeGreaterThan(slopeVariances[(SLOPE_ENTRIES - 1) * 2 + 1])
  })
})

describe('cascades', () => {
  it('reaches from about a kilometre to a few millimetres', () => {
    expect(CASCADE_SIZES[0]).toBeGreaterThan(1000)
    expect((2 * CASCADE_SIZES[5]) / CASCADE_SAMPLES).toBeCloseTo(0.002, 3)
  })

  it('gives every wave to exactly one cascade', () => {
    for (let i = 0; i < CASCADES - 1; i++) expect(cascadeBand(i)[1]).toBe(cascadeBand(i + 1)[0])
    expect(cascadeBand(0)[0]).toBe(0)
    expect(cascadeBand(CASCADES - 1)[1]).toBe(Infinity)
  })

  it('keeps every band within what its cascade can hold', () => {
    for (let i = 0; i < CASCADES - 1; i++) {
      const step = (2 * Math.PI) / CASCADE_SIZES[i]
      expect(cascadeBand(i)[1]).toBeLessThan((step * CASCADE_SAMPLES) / 4)
      const next = (2 * Math.PI) / CASCADE_SIZES[i + 1]
      expect(cascadeBand(i + 1)[0]).toBeCloseTo(next * 6, 6)
    }
  })
})

describe('cascadeSpectrum', () => {
  const ocean: Ocean = { ...WIND_WAVES, swell: { height: 0.9, period: 11.5, heading: -1.25, spread: 0.11 } }
  const samples = CASCADE_SAMPLES

  function wave(data: Float32Array, x: number, y: number) {
    const at = (y * samples + x) * SPECTRUM_STRIDE
    return { re: data[at], im: data[at + 1], omega: data[at + 2], perK: data[at + 3] }
  }

  it('gives four values for every wave of its 256×256', () => {
    expect(cascadeSpectrum(ocean, 1)).toHaveLength(samples * samples * SPECTRUM_STRIDE)
  })

  // Made twice over, the same: so it is the same ocean every time, too.
  it('can be worked out a row at a time, for the page to paint between them, to the same ocean', () => {
    const making = cascadeSpectrumInSteps(ocean, CASCADES - 1)
    let rows = 0
    let step = making.next()
    for (; !step.done; step = making.next()) rows++
    expect(rows).toBe(samples)
    expect(step.value).toEqual(cascadeSpectrum(ocean, CASCADES - 1))
  })

  it('has nothing at frequency 0 or on the Nyquist rows and columns, which have no opposites', () => {
    const data = cascadeSpectrum(ocean, 1)
    expect(wave(data, 0, 0).re).toBe(0)
    for (let i = 0; i < samples; i++) {
      expect(wave(data, samples / 2, i).re).toBe(0)
      expect(wave(data, i, samples / 2).re).toBe(0)
    }
  })

  it('leaves out what belongs to another cascade', () => {
    const data = cascadeSpectrum(ocean, 1)
    const step = (2 * Math.PI) / CASCADE_SIZES[1]
    const [low, high] = cascadeBand(1)
    const held: number[] = []
    for (let y = 0; y < samples; y++) {
      for (let x = 0; x < samples; x++) {
        const fx = x <= samples / 2 ? x : x - samples
        const fy = y <= samples / 2 ? y : y - samples
        if (wave(data, x, y).perK) held.push(Math.hypot(fx, fy) * step)
      }
    }
    expect(held.length).toBeGreaterThan(1000)
    expect(Math.min(...held)).toBeGreaterThanOrEqual(low)
    expect(Math.max(...held)).toBeLessThan(high)
  })

  it('keeps frequencies to whole cycles of the loop, so that the ocean wraps cleanly', () => {
    const data = cascadeSpectrum(ocean, 0)
    const { omega } = wave(data, 12, 7)
    const cycles = (omega * LOOP_SECONDS) / (2 * Math.PI)
    // A float's worth of error in a number this size.
    expect(Math.abs(cycles - Math.round(cycles))).toBeLessThan(1e-2)
    expect(omega).toBeCloseTo(angularFrequency(Math.hypot(12, 7) * ((2 * Math.PI) / CASCADE_SIZES[0])), 1)
  })

  it('adds up, over all the cascades, to the wave height of the ocean', () => {
    let variance = 0
    for (let i = 0; i < CASCADES; i++) {
      const data = cascadeSpectrum(ocean, i)
      for (let at = 0; at < data.length; at += SPECTRUM_STRIDE) {
        variance += 2 * (data[at] * data[at] + data[at + 1] * data[at + 1])
      }
    }
    const height = 4 * Math.sqrt(variance)
    // A random ocean: one draw of it, on a grid, comes close and no closer.
    expect(height / oceanStatistics(ocean).significantHeight).toBeGreaterThan(0.7)
    expect(height / oceanStatistics(ocean).significantHeight).toBeLessThan(1.3)
  })

  it('has waves go downwind far more than upwind', () => {
    const model = oceanModel(WIND_WAVES)
    const k = 0.5
    expect(model.polar(k, WIND_WAVES.heading)).toBeGreaterThan(10 * model.polar(k, WIND_WAVES.heading + Math.PI))
  })
})

describe('the band a cascade holds its waves in', () => {
  it.each([0, 1, 2, 3, 4])('holds every wave of cascade %d', (index) => {
    const waves = cascadeSpectrum(WIND_WAVES, index)
    for (let y = 0; y < CASCADE_SAMPLES; y++) {
      for (let x = 0; x < CASCADE_SAMPLES; x++) {
        if (inBand(x) < BAND_SAMPLES && inBand(y) < BAND_SAMPLES) continue
        expect(waves[(y * CASCADE_SAMPLES + x) * SPECTRUM_STRIDE]).toBe(0)
      }
    }
  })

  it('keeps each wave where the band says it is', () => {
    const waves = cascadeSpectrum(WIND_WAVES, 1)
    const kept = keptSpectrum(waves, 1)
    const [x, y] = [6, CASCADE_SAMPLES - 8]
    const from = (y * CASCADE_SAMPLES + x) * SPECTRUM_STRIDE
    const to = (inBand(y) * BAND_SAMPLES + inBand(x)) * SPECTRUM_STRIDE
    expect(waves[from]).not.toBe(0)
    expect([...kept.subarray(to, to + SPECTRUM_STRIDE)]).toEqual([...waves.subarray(from, from + SPECTRUM_STRIDE)])
  })

  it('keeps all of the last cascade, which has nothing to hand on to', () => {
    const waves = cascadeSpectrum(WIND_WAVES, CASCADES - 1)
    expect(keptSpectrum(waves, CASCADES - 1)).toBe(waves)
  })

  it('comes to what the buffer is made to hold', () => {
    const total = Array.from({ length: CASCADES }, (_, i) => keptSpectrum(cascadeSpectrum(WIND_WAVES, i), i).length)
    expect(total.reduce((sum, length) => sum + length, 0)).toBe(KEPT_WAVES * SPECTRUM_STRIDE)
  })
})
