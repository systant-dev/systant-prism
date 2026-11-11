// The little arithmetic every scene shares: a way or a place as three numbers, and a
// number kept from 0 to 1. Nothing here touches a GPU, React or a DOM, so a server can
// take it in with daylight.ts (src/server.ts). It is the scenes' own, rather than
// src/shared's, so that their code, fetched only once a scene is wanted, need reach
// back for nothing in the page's.

/** A way, or a place: x to the right, y up and z ahead, unless what holds it says otherwise. */
export type Vec3 = [number, number, number]

export function dot(a: readonly number[], b: readonly number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: readonly number[], b: readonly number[]): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/** `v` at a length of 1. */
export function unit(v: readonly number[]): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2])
  return [v[0] / length, v[1] / length, v[2] / length]
}

/** `value` kept from 0 to 1, as WGSL's saturate keeps it. */
export function saturate(value: number) {
  return Math.min(1, Math.max(0, value))
}
