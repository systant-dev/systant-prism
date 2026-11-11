// Which way the view of the night sky faces. A scene looks at the lowest few degrees of
// the sky, as a person standing on the shore or on the hill would, and that lowest part
// holds the Milky Way only some nights and some hours: on an autumn evening in the
// north it arches overhead and touches the horizon only to the west and the east.
//
// The moon is already drawn where it looks best rather than where it is (daylight.ts).
// The stars are turned the same way: each night the view of the sky faces where the
// Milky Way is best seen low down through the hours of darkness, as someone who came
// out to see it would turn to it. It faces that way all night, so that the sky turns
// across it just as the real one does, steadily, and it only turns to face another way
// at noon, when there are no stars to see. Where the Milky Way is low ahead anyway, the
// view stays facing the equator, as the real sky would show it.
import { type Place, solarDay } from '../daylight'
import type { Vec3 } from '../maths'
import { fromGround, galaxyAxes, groundWay, heavensAt, milkyWayOut, starsOut, toGalactic } from './celestial'
import type { CrowdingMap } from './stars'

const HOUR = 3_600_000
const QUARTER = HOUR / 4

/** How many hours either side of the middle of the night are judged. */
const HOURS = 9

/** How many ways the view can face, round the horizon. */
const STEPS = 36

/** How much less a view facing away from the equator counts for, at the most: it is not quite as the sky would be. */
const AWAY = 0.25

/** The part of the sky each way is judged by: from how low to how high, in radians, and how much its sides count against its middle. */
const BOTTOM = 0.03
const TOP = 0.26
const SIDES = [0.4, 0.8, 1, 0.8, 0.4]

/** The middle of the night nearest a moment, by the sun: as a moment in ms. */
export function midnightNear(date: Date, place: Place) {
  const { hourAngle } = solarDay(date, place)
  const day = 24 * HOUR
  const toMidnight = hourAngle >= 0 ? Math.PI - hourAngle : -(Math.PI + hourAngle)
  return date.getTime() + (toMidnight / (2 * Math.PI)) * day
}

/** How much of the Milky Way a view facing this many radians from the equator sees, through the air, at a moment, from 0. */
function milkyWayIn(rows: number[], crowding: CrowdingMap, facing: number, side: number, axes: Vec3[]) {
  let light = 0
  for (let a = -2; a <= 2; a++) {
    const across = facing + (side * a) / 2
    for (let e = 0; e < 3; e++) {
      const up = BOTTOM + ((TOP - BOTTOM) * e) / 2
      const way = fromGround(rows, groundWay(across, up))
      const [crowded, through] = crowding.at(toGalactic(way, axes))
      light += SIDES[a + 2] * (crowded - 1) * through * Math.exp(-0.1 / (2 * Math.sin(up) + 0.05))
    }
  }
  return light
}

/**
 * Which way the view faces all through one night, from its middle: the way that sees
 * the most of the Milky Way across the dark hours. Each hour counts by the square root
 * of what it sees, so that a way that shows some of it all night beats one that shows
 * a lot of it for an hour. Ties go to the equator.
 */
export function facingForNight(midnight: number, place: Place, crowding: CrowdingMap, side: number): number {
  const axes = galaxyAxes()
  const total = new Array(STEPS).fill(0)
  for (let h = -HOURS; h <= HOURS; h++) {
    const date = new Date(midnight + h * HOUR)
    const dark = milkyWayOut(starsOut(solarDay(date, place).height))
    if (dark <= 0) continue
    const rows = heavensAt(date, place)
    for (let step = 0; step < STEPS; step++) {
      total[step] += Math.sqrt(dark * milkyWayIn(rows, crowding, (step * 2 * Math.PI) / STEPS, side, axes))
    }
  }
  let best = 0
  let bestValue = 0
  for (let step = 0; step < STEPS; step++) {
    const facing = (step * 2 * Math.PI) / STEPS
    const value = total[step] * (1 - (AWAY * (1 - Math.cos(facing))) / 2)
    if (value > bestValue + 1e-9) {
      best = step
      bestValue = value
    }
  }
  const facing = (best * 2 * Math.PI) / STEPS
  return Math.atan2(Math.sin(facing), Math.cos(facing))
}

/**
 * Which way a view reaching `side` radians either way of its middle faces at a moment:
 * the way for the night nearest it, which changes only at noon. Kept for the nights asked.
 */
export function facingPlanner(place: Place, crowding: CrowdingMap, side: number) {
  const nights = new Map<number, number>()
  return (date: Date) => {
    // To a quarter of an hour, which the middle of a night stays within all through it.
    const midnight = Math.round(midnightNear(date, place) / QUARTER) * QUARTER
    let facing = nights.get(midnight)
    if (facing === undefined) {
      if (nights.size > 3) nights.clear()
      facing = facingForNight(midnight, place, crowding, side)
      nights.set(midnight, facing)
    }
    return facing
  }
}
