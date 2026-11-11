/**
 * Calls `onChange` when the device pixel ratio changes, which a browser zoom
 * does, and a window moved to a screen of another density, often without
 * anything changing size in CSS px for a resize to report. A media query matches
 * only the ratio it was made for, so each change makes the next one's. Returns a
 * function that stops watching.
 */
export function watchPixelRatio(onChange: () => void): () => void {
  let stop = () => {}

  function watch() {
    const query = window.matchMedia?.(`(resolution: ${devicePixelRatio}dppx)`)
    if (!query) return
    function onQueryChange() {
      stop()
      watch()
      onChange()
    }
    query.addEventListener('change', onQueryChange)
    stop = () => query.removeEventListener('change', onQueryChange)
  }

  watch()
  return () => stop()
}
