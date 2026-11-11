import { describe, expect, it } from 'vitest'
import { lightSky, SKY_UNIFORM } from './skyLight'

const FIELDS = 64

/** The light of a sky with the sun at this height, and how much of the moon shows, in how much rain. */
function sky(sunHeight: number, moonShown = 0, rain = 0) {
  const data = new Float32Array(FIELDS)
  data.set([0, sunHeight, Math.sqrt(1 - sunHeight * sunHeight), sunHeight], SKY_UNIFORM.sun)
  data.set([0, 0.2, Math.sqrt(1 - 0.04), moonShown], SKY_UNIFORM.moon)
  data[SKY_UNIFORM.rain] = rain
  lightSky(data)
  const field = (at: number) => [...data.subarray(at, at + 3)]
  return {
    sunlit: field(SKY_UNIFORM.sunlit),
    skylit: field(SKY_UNIFORM.skylit),
    moonlit: field(SKY_UNIFORM.moonlit),
    clouded: field(SKY_UNIFORM.clouded),
    overhead: field(SKY_UNIFORM.overhead),
    lowSky: field(SKY_UNIFORM.lowSky),
  }
}

describe('lightSky', () => {
  it('has no sun once it is 6° down', () => {
    expect(sky(-0.11).sunlit).toEqual([0, 0, 0])
    expect(sky(-0.11).skylit).toEqual([0, 0, 0])
  })

  it('reddens the sun as it gets low', () => {
    const low = sky(0.02).sunlit
    const high = sky(0.9).sunlit
    expect(low[0] / low[2]).toBeGreaterThan(high[0] / high[2])
  })

  it('keeps the sky blue overhead by day', () => {
    const [red, , blue] = sky(0.7).overhead
    expect(blue).toBeGreaterThan(red)
  })

  it('leaves what the night has of its own once the sun has gone', () => {
    const [red, green, blue] = sky(-0.5).overhead
    expect(red).toBeCloseTo(0.006, 3)
    expect(green).toBeCloseTo(0.01, 3)
    expect(blue).toBeCloseTo(0.026, 3)
  })

  it('has the moon light the night only as far as it shows', () => {
    expect(sky(-0.5, 0).moonlit).toEqual([0, 0, 0])
    expect(sky(-0.5, 1).moonlit[1]).toBeGreaterThan(0)
  })

  it('takes nearly all the light of the sun under rain cloud', () => {
    const clear = sky(0.7).sunlit
    const raining = sky(0.7, 0, 1).sunlit
    expect(raining[1]).toBeCloseTo(clear[1] * 0.003, 4)
  })

  it('makes the sky the colour of the cloud in full rain, brighter overhead than low down', () => {
    const { clouded, overhead, lowSky } = sky(0.7, 0, 1)
    expect(overhead[1]).toBeCloseTo(clouded[1] * 1.45, 4)
    expect(lowSky[1]).toBeLessThan(overhead[1])
  })
})
