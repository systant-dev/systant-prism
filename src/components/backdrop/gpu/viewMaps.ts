// Where a pixel of the viewport lies in what is drawn there: each map is four numbers,
// `uv = px * map.xy + map.zw`, with px in CSS px from the viewport's top left.

export type Map4 = [number, number, number, number]

/** `uv = px * map.xy + map.zw` for an image covering, centred, a viewport (background-size: cover). */
export function coverMap(viewWidth: number, viewHeight: number, imageWidth: number, imageHeight: number): Map4 {
  const scale = Math.max(viewWidth / imageWidth, viewHeight / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return [1 / width, 1 / height, (width - viewWidth) / 2 / width, (height - viewHeight) / 2 / height]
}

/** `uv = px * map.xy + map.zw` for a screen-sized target. */
export function screenMap(viewWidth: number, viewHeight: number): Map4 {
  return [1 / viewWidth, 1 / viewHeight, 0, 0]
}
