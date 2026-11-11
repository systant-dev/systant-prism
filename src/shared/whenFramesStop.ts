/**
 * Calls `onStop`, once, if a whole `wait` ms goes by with no animation frame while
 * the page is on show. Returns what stops watching.
 *
 * A browser draws no frames for a page it isn't showing, and says so by
 * `document.hidden`, so that time doesn't count, and coming back into view starts the
 * wait afresh. But it can stop them for a page it still says is visible: an app
 * hiding the view it embeds the page in (an Electron or WebView pane), or a
 * cross-origin iframe scrolled out of sight. Nothing is painted then either, so
 * whatever is waiting for a frame waits for as long as that lasts.
 *
 * It asks for one frame each `wait`, not one every frame, so watching costs next to nothing.
 */
export function whenFramesStop(wait: number, onStop: () => void): () => void {
  // Whether a frame has come, or the page come back into view, since the last look.
  let lively = false
  let frame = requestAnimationFrame(onFrame)
  let timer = setTimeout(look, wait)

  function onFrame() {
    lively = true
  }

  function onVisibilityChange() {
    lively = true
  }

  function look() {
    if (!lively && !document.hidden) {
      stop()
      onStop()
      return
    }
    lively = false
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(onFrame)
    timer = setTimeout(look, wait)
  }

  function stop() {
    clearTimeout(timer)
    cancelAnimationFrame(frame)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  return stop
}
