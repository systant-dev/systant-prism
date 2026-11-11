// Where the sun and moon are at a moment, at a place, and so how far through its
// day a scene is. Nothing here touches a GPU, so all of it can be tested.
//
// The sun's height is the real one, by the low-precision formulae of the
// Astronomical Almanac, good to a few minutes of sunrise. It sets how much light
// there is, and of what colour, so the sky dims at the real sunset, at any
// time of year.
//
// Where the sun and moon are drawn is not the real place. The view takes in only
// the lowest 15° of the sky, while the real sun can spend the middle of the day 60°
// up and the real moon can be up by day, or not at all by night. So each stays in
// the middle of the view and only rises and sinks, driven by the real sunrise and
// sunset: the sun up out of the ocean through the morning and down into it through
// the afternoon, and the moon the same through the night, coming up where the sun
// went down.
//
// A hidden page draws no frames, so its sky falls behind the clock. Coming back,
// the time shown runs on to catch up rather than the sky jumping there, or
// being blended there: running the clock has the sun actually set and the moon
// actually rise, with the dusk between them, if that is what was missed.
//
// The browser can't be asked where it is without a prompt, which is too much to
// ask for a background. Its time zone is a fair guess, as most zones are named
// for a city and all the rest for a part of the world.

// Straight from the module, not the index, which takes in hooks: a server imports this (src/server.ts).
import { easeInOut } from '../../../../shared/easing'
import { saturate, type Vec3 } from './maths'

export interface Place {
  /** In degrees, north positive. */
  latitude: number
  /** In degrees, east positive. */
  longitude: number
}

/** How high the sun's centre is at sunset, in radians: refraction lifts it into view. */
const SUNSET_ALTITUDE = (-0.833 * Math.PI) / 180

/** How high either gets over the ocean, in radians: just inside the top of the view. */
const PEAK = 0.21

/** How far down the view looks over the ocean, and how high that view is, in radians: where the horizon lies. */
export const HORIZON_PITCH = 0.1
export const HORIZON_HALF_FOV = 0.36

/**
 * How far level ground lies below the ocean's horizon on the screen through the forest's
 * long lens, as a share of the view's height from the middle: 25 rows of 1080. That is
 * what it takes to put the tree line that is seen where the ocean is seen to meet the sky,
 * as measured from the two rendered at every time of day. The leaves stand a little
 * above the eye, and haze takes the far ocean into the sky a little below the true horizon.
 */
export const TREE_LINE_DROP = 25 / 540

const LONG_HALF_FOV = 0.2

/**
 * The forest's long lens, which the discs of the sun and moon are sized for: through
 * any other they are drawn as big and as round on the screen as through this. It looks
 * as far down as puts the tree line as high on the screen as the ocean's horizon, for the
 * sun to set behind it there.
 */
export const LONG_LENS: Lens = {
  pitch: Math.atan(Math.tan(LONG_HALF_FOV) * (Math.tan(HORIZON_PITCH) / Math.tan(HORIZON_HALF_FOV) - TREE_LINE_DROP)),
  halfFov: LONG_HALF_FOV,
}

/**
 * How flat the air draws a disc that is on the horizon, as a share of its height, and how
 * high its centre is, as a sine, by the time it is round again. discOnScreen here and
 * onDisc in skyShaders.ts both go by these, and have to: one sizes the disc that the
 * other draws.
 */
export const DISC_FLATTEST = 0.88
export const DISC_ROUND_BY = 0.05

/** How far the moon's face leans as it rises and as it sets, in radians. */
const MOON_LEAN = 0.6

/** Radians in a degree. */
export const RADIANS = Math.PI / 180

/** The most the clock moves on between two frames, in ms, before it counts as time missed. */
const MISSED_TIME = 5000

/** One day, in ms. */
const DAY = 86_400_000

/** How high the sun is as it starts to look like night, as a sine: about 3° down, halfway through twilight. */
const NIGHT_FALLS = -0.05

/** How long catching up takes, in seconds: at the least, for each hour missed, and at the most. */
const CATCH_UP_LEAST = 1
const CATCH_UP_PER_HOUR = 0.5
const CATCH_UP_MOST = 4

export interface SolarDay {
  /** The sine of the sun's height above the horizon: 0 on it, negative below it. */
  height: number
  /** How far the sun is past its highest, in radians, −π to π. */
  hourAngle: number
  /** The hour angle of sunset: 0 where it doesn't rise today, π where it doesn't set. */
  sunset: number
  /** How far north of the equator the sun is, in radians. */
  declination: number
}

/** How far the sky has turned at a moment, at a longitude, in radians: the right ascension overhead. */
export function localSidereal(date: Date, longitude: number) {
  return ((siderealDegrees(daysSinceJ2000(date)) + longitude) % 360) * RADIANS
}

/** The days since noon on 1 January 2000, which the Almanac's formulae count from. */
function daysSinceJ2000(date: Date) {
  return date.getTime() / DAY + 2440587.5 - 2451545
}

/** How far the sky has turned over Greenwich that many days on, in degrees, the whole turns still in it. */
function siderealDegrees(days: number) {
  return 280.46061837 + 360.98564736629 * days
}

/** The sun at a moment, at a place. */
export function solarDay(date: Date, { latitude, longitude }: Place): SolarDay {
  const days = daysSinceJ2000(date)
  const meanLongitude = 280.46 + 0.9856474 * days
  const anomaly = (357.528 + 0.9856003 * days) * RADIANS
  const ecliptic = (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RADIANS
  const tilt = (23.439 - 0.0000004 * days) * RADIANS
  const declination = Math.asin(Math.sin(tilt) * Math.sin(ecliptic))
  const rightAscension = Math.atan2(Math.cos(tilt) * Math.sin(ecliptic), Math.cos(ecliptic))

  const turned = (siderealDegrees(days) + longitude) * RADIANS - rightAscension
  const hourAngle = Math.atan2(Math.sin(turned), Math.cos(turned))

  const north = latitude * RADIANS
  const shared = Math.sin(north) * Math.sin(declination)
  const apart = Math.cos(north) * Math.cos(declination)
  const atSunset = (Math.sin(SUNSET_ALTITUDE) - shared) / apart
  return {
    height: shared + apart * Math.cos(hourAngle),
    hourAngle,
    sunset: Math.acos(Math.min(1, Math.max(-1, atSunset))),
    declination,
  }
}

/** Whether a sky at this moment and place looks more like night than day. */
export function isNight(date: Date, place: Place) {
  return solarDay(date, place).height < NIGHT_FALLS
}

/**
 * The way to the sun where it really is, as the view lies: looking towards the
 * equator, with the sun crossing in front of it at noon, from left to right, or from
 * right to left south of the equator. A scene lit from where the sun's disc is drawn
 * would be lit from straight ahead all day.
 */
export function sunWay(date: Date, place: Place): Vec3 {
  const { height, hourAngle, declination } = solarDay(date, place)
  const north = place.latitude * RADIANS
  const facing = place.latitude >= 0 ? 1 : -1
  const across = Math.cos(declination) * Math.sin(hourAngle)
  const ahead = Math.sin(north) * Math.cos(declination) * Math.cos(hourAngle) - Math.cos(north) * Math.sin(declination)
  return [across * facing, height, ahead * facing]
}

/**
 * The way to the moon where it really is, as `sunWay` has it for the sun. It is
 * always full here, and a full moon lies opposite the sun: high at midnight in
 * winter, as the sun is at noon in summer, and low in summer.
 */
export function moonWay(date: Date, place: Place): Vec3 {
  const [across, height, ahead] = sunWay(date, place)
  return [-across, -height, -ahead]
}

export interface Sky {
  /** The way to the sun, carrying on below the horizon. */
  sun: Vec3
  /** How much wider and taller than as sized its disc is drawn, to look the same on the screen through any lens. Its glare goes by the first. */
  sunSize: [number, number]
  /** The sine of the real sun's height, which sets the light. */
  sunHeight: number
  /** The way to the moon. */
  moon: Vec3
  /** How much wider and taller than as sized its disc is drawn, as `sunSize`. */
  moonSize: [number, number]
  /** How much of the moon shows, 0–1: none by day, all by night. */
  moonlight: number
  /** How far its face has turned from north up, in radians. */
  moonTilt: number
}

/** How a scene's view lies, if not as over the ocean: how far down it looks, and how high it is from the middle to the top, in radians. */
export interface Lens {
  pitch: number
  halfFov: number
}

const OCEAN: Lens = { pitch: HORIZON_PITCH, halfFov: HORIZON_HALF_FOV }

/**
 * How high on the screen something in the middle of the view is, 0–1 from rising to
 * setting, as a share of the view's height from the middle. It climbs as it would over
 * the ocean, and is put at the same height through any other lens.
 */
function onScreen(progress: number) {
  const overOcean = PEAK * Math.sin(Math.PI * progress)
  return Math.tan(overOcean + HORIZON_PITCH) / Math.tan(HORIZON_HALF_FOV)
}

/** The way to something in the middle of the view, `height` up the screen, so that it doesn't move as one scene gives way to another. */
function acrossTheView(height: number, { pitch, halfFov }: Lens): Vec3 {
  const elevation = Math.atan(height * Math.tan(halfFov)) - pitch
  return [0, Math.sin(elevation), Math.cos(elevation)]
}

/**
 * How wide and how tall a disc of sky a radian across is drawn `height` up the screen,
 * as shares of the view's height from the middle. Away from the middle the view draws
 * the sky out, across by the slant and up by its square. Close to the horizon the air
 * flattens a disc as well, by how high its centre really is: onDisc in skyShaders.ts.
 */
function discOnScreen(height: number, { pitch, halfFov }: Lens): [number, number] {
  const tall = Math.tan(halfFov)
  const slant = Math.atan(height * tall)
  const flattened = DISC_FLATTEST + (1 - DISC_FLATTEST) * saturate(Math.sin(slant - pitch) / DISC_ROUND_BY)
  return [1 / (Math.cos(slant) * tall), flattened / (Math.cos(slant) ** 2 * tall)]
}

/**
 * How much wider and taller than as sized a disc is drawn `height` up the screen through
 * `lens`, for it to look as it does through the long lens, so that it keeps its size and
 * shape as one scene gives way to another.
 */
function discSize(height: number, lens: Lens): [number, number] {
  const [wide, tall] = discOnScreen(height, LONG_LENS)
  const [seenWide, seenTall] = discOnScreen(height, lens)
  return [wide / seenWide, tall / seenTall]
}

/** The sky at a moment, at a place, with the discs of the sun and moon where they would be seen through `lens`. */
export function skyAt(date: Date, place: Place, lens: Lens = OCEAN): Sky {
  const { height, hourAngle, sunset } = solarDay(date, place)

  // Past each horizon by a little, so that the glow of the sun sinks after it.
  const day = sunset > 0 ? (hourAngle + sunset) / (2 * sunset) : -1
  const past = (((hourAngle - sunset) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const nightLength = 2 * (Math.PI - sunset)
  const night = nightLength > 0 ? Math.min(1, past / nightLength) : 1
  // Comes up as the sun goes down, and is gone by the time it comes back.
  const shown = saturate(-height / 0.1)
  // It rises leaning one way and sets leaning the other, and is upside down south of the equator.
  const lean = MOON_LEAN * (2 * night - 1)

  const sunUp = onScreen(Math.min(1.25, Math.max(-0.25, day)))
  const moonUp = onScreen(night)

  return {
    sun: acrossTheView(sunUp, lens),
    sunSize: discSize(sunUp, lens),
    sunHeight: height,
    moon: acrossTheView(moonUp, lens),
    moonSize: discSize(moonUp, lens),
    moonlight: shown * shown * (3 - 2 * shown),
    moonTilt: place.latitude < 0 ? Math.PI - lean : lean,
  }
}

/**
 * A clock for the sky, to read once a frame with the true time in ms and how long
 * the scene has run in seconds. It gives the true time, until the true time jumps:
 * then what it gives runs on from where it was, easing in and out, until it has
 * caught up. A whole day looks the same as none, so only what is left over is run.
 * With `straight` it gives the time it is given, without running on to it, and any
 * later jump runs on from there.
 */
export function skyClock(): (moment: number, seconds: number, straight?: boolean) => number {
  let last: number | null = null
  let behind = 0
  let startedAt = 0
  let duration = 1

  const lag = (seconds: number) => {
    const progress = Math.min(1, (seconds - startedAt) / duration)
    return behind * (1 - easeInOut(progress))
  }

  return (moment, seconds, straight = false) => {
    const missed = last === null ? 0 : moment - last
    last = moment
    if (straight) behind = 0
    else if (Math.abs(missed) > MISSED_TIME) {
      behind = (lag(seconds) + missed) % DAY
      startedAt = seconds
      const hours = Math.abs(behind) / 3_600_000
      duration = Math.min(CATCH_UP_MOST, CATCH_UP_LEAST + hours * CATCH_UP_PER_HOUR)
    }
    return moment - lag(seconds)
  }
}

/** Where the time zones named for the largest cities are: latitude and longitude. */
const ZONES: Record<string, [number, number]> = {
  'Africa/Cairo': [30, 31.2],
  'Africa/Johannesburg': [-26.2, 28],
  'Africa/Lagos': [6.5, 3.4],
  'Africa/Nairobi': [-1.3, 36.8],
  'America/Anchorage': [61.2, -149.9],
  'America/Argentina/Buenos_Aires': [-34.6, -58.4],
  'America/Bogota': [4.7, -74.1],
  'America/Chicago': [41.9, -87.6],
  'America/Denver': [39.7, -105],
  'America/Lima': [-12, -77],
  'America/Los_Angeles': [34, -118.2],
  'America/Mexico_City': [19.4, -99.1],
  'America/New_York': [40.7, -74],
  'America/Phoenix': [33.4, -112],
  'America/Santiago': [-33.4, -70.7],
  'America/Sao_Paulo': [-23.6, -46.6],
  'America/Toronto': [43.7, -79.4],
  'America/Vancouver': [49.3, -123.1],
  'Asia/Bangkok': [13.8, 100.5],
  'Asia/Dhaka': [23.8, 90.4],
  'Asia/Dubai': [25.2, 55.3],
  'Asia/Hong_Kong': [22.3, 114.2],
  'Asia/Jakarta': [-6.2, 106.8],
  'Asia/Jerusalem': [31.8, 35.2],
  'Asia/Karachi': [24.9, 67],
  'Asia/Kolkata': [22.6, 88.4],
  'Asia/Manila': [14.6, 121],
  'Asia/Seoul': [37.6, 127],
  'Asia/Shanghai': [31.2, 121.5],
  'Asia/Singapore': [1.4, 103.8],
  'Asia/Tehran': [35.7, 51.4],
  'Asia/Tokyo': [35.7, 139.7],
  'Australia/Adelaide': [-34.9, 138.6],
  'Australia/Brisbane': [-27.5, 153],
  'Australia/Melbourne': [-37.8, 145],
  'Australia/Perth': [-31.9, 115.9],
  'Australia/Sydney': [-33.9, 151.2],
  'Europe/Amsterdam': [52.4, 4.9],
  'Europe/Athens': [38, 23.7],
  'Europe/Berlin': [52.5, 13.4],
  'Europe/Brussels': [50.8, 4.4],
  'Europe/Copenhagen': [55.7, 12.6],
  'Europe/Dublin': [53.3, -6.3],
  'Europe/Helsinki': [60.2, 24.9],
  'Europe/Istanbul': [41, 29],
  'Europe/Kyiv': [50.4, 30.5],
  'Europe/Lisbon': [38.7, -9.1],
  'Europe/London': [51.5, -0.1],
  'Europe/Madrid': [40.4, -3.7],
  'Europe/Moscow': [55.8, 37.6],
  'Europe/Oslo': [59.9, 10.8],
  'Europe/Paris': [48.9, 2.4],
  'Europe/Prague': [50.1, 14.4],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Stockholm': [59.3, 18.1],
  'Europe/Vienna': [48.2, 16.4],
  'Europe/Warsaw': [52.2, 21],
  'Europe/Zurich': [47.4, 8.5],
  'Pacific/Auckland': [-36.8, 174.8],
  'Pacific/Honolulu': [21.3, -157.9],
}

/** A latitude for a time zone that isn't listed, by the part of the world it is named for. */
const REGIONS: Record<string, number> = {
  Africa: 5,
  America: 38,
  Antarctica: -75,
  Arctic: 78,
  Asia: 30,
  Atlantic: 40,
  Australia: -30,
  Europe: 50,
  Indian: -10,
  Pacific: -15,
}

/**
 * Where a time zone most likely is. One that isn't listed takes the latitude of
 * its part of the world, and the longitude of its time: 15° for each hour of its
 * `standardOffset` east of Greenwich, in minutes.
 */
export function placeOfZone(zone: string, standardOffset: number): Place {
  const known = ZONES[zone]
  if (known) return { latitude: known[0], longitude: known[1] }
  return { latitude: REGIONS[zone.split('/')[0]] ?? 40, longitude: standardOffset / 4 }
}

/** Where the browser most likely is, by its time zone. */
export function localPlace(now: Date): Place {
  const year = now.getFullYear()
  // Summer time puts one of these an hour on, and the standard time is the other.
  const west = Math.max(new Date(year, 0, 1).getTimezoneOffset(), new Date(year, 6, 1).getTimezoneOffset())
  return placeOfZone(Intl.DateTimeFormat().resolvedOptions().timeZone, -west)
}
