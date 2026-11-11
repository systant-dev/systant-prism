import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { readCssNumber } from '../../../shared'
import type { Axis } from './orientation'
import { springPills, type Place } from './springPills'

export interface Pill<T> {
  ref: RefObject<HTMLElement | null>
  /** The entry it sits on, or null while it is hidden. */
  target: T | null
  /**
   * Follows its target on a spring rather than gliding on a transition, taking
   * about the time this custom property gives to get there.
   */
  spring?: string
}

/**
 * Keeps each pill on its target entry, and the press's shrink a fixed length
 * whatever the entry's width (see selector.styles.ts).
 *
 * A pill is placed after every render, since its target or an entry's size
 * may have changed, and when the list or any entry resizes, which moves the
 * entries without a render. An entry can resize while the list doesn't: in a
 * list given a width, a web font arriving reshares the width among entries of
 * new lengths. It glides to a new target, but is simply put there when it was
 * hidden (so it appears in place rather than gliding in from where it last
 * was) or something resized. A pill hidden but not yet faded out glides on,
 * as it is still to be seen: put in place, it would jump. A pill whose own
 * entry moved or resized keeps up with it too, rather than gliding after it,
 * even when a render notices before the resize is reported: as a page loads,
 * its web font swaps in under entries already laid out in the fallback.
 *
 * A pill is placed by the entry's offset and size along `axis`, written to it
 * as `${name}-${axis.offsetProperty}` and `${name}-${axis.sizeProperty}`
 * (--prism-vertical-selector-y and --prism-vertical-selector-height, say).
 *
 * A pill given a `spring` still has its target written there, but is moved
 * towards it frame by frame on a spring (springPills.ts), written as the
 * internal `--_${name}-spring-${axis.offsetProperty}` and `-${axis.sizeProperty}`
 * (--_prism-vertical-selector-spring-y, say). It is put in place wherever
 * another pill would be, and with prefers-reduced-motion, or where there are
 * no animation frames.
 *
 * The shrink, `${name}-press-shrink`, is taken off each entry's width as the
 * --prism-press-scale written to it, and each pill takes the scale of the
 * entry it is on. It is read when the list is first observed and whenever it
 * or an entry resizes, not on every render, as reading it costs a style
 * recalculation: a change to the shrink alone shows from the next resize.
 */
export function usePillLayout<T>(
  listRef: RefObject<HTMLElement | null>,
  pills: readonly Pill<T>[],
  options: ReadonlyMap<T, HTMLElement>,
  axis: Axis,
  name: string,
) {
  // Where each pill was last placed, and on which entry, or null while it is hidden.
  const placed = useRef<((Place & { target: T | null }) | null)[]>([])
  // The shrink in px, once the list has been measured.
  const shrink = useRef<number | null>(null)
  // The latest pills, for a resize to place: updated as each render commits.
  const pillsRef = useRef(pills)
  // Watches the list and its entries for resizes, once mounted.
  const observer = useRef<ResizeObserver | null>(null)
  const observed = useRef(new Set<Element>())
  const [springs] = useState(() => springPills(axis, `--_${name.slice(2)}-spring`))

  // The scale that takes the shrink off `width`.
  function fitScale(el: HTMLElement, width: number) {
    if (shrink.current === null || !width) return
    const scale = String(Math.max(0, 1 - shrink.current / width))
    if (el.style.getPropertyValue('--prism-press-scale') !== scale) el.style.setProperty('--prism-press-scale', scale)
  }

  // Any of it still showing, part way through fading out. Read only as a
  // hidden pill is shown again, as it costs a style recalculation.
  function visible(pill: HTMLElement) {
    return Number(getComputedStyle(pill).opacity) > 0
  }

  function place({ ref, target, spring }: Pill<T>, i: number, instant: boolean) {
    const pill = ref.current
    const option = target === null ? undefined : options.get(target)
    if (!pill || !option) {
      placed.current[i] = null
      return
    }
    const next = axis.measure(option)
    const from = placed.current[i]
    if (from && from.target === target && from.offset === next.offset && from.size === next.size) return
    placed.current[i] = { target, ...next }

    // Only a new target glides: on the same one, its entry has moved or resized.
    // A pill shown again while it is still fading out glides from where it is.
    const jump = instant || (from ? from.target === target : !visible(pill))
    if (jump) pill.setAttribute('data-instant', '')
    pill.style.setProperty(`${name}-${axis.offsetProperty}`, `${next.offset}px`)
    pill.style.setProperty(`${name}-${axis.sizeProperty}`, `${next.size}px`)
    fitScale(pill, option.offsetWidth)
    if (spring) springs.follow(i, pill, next, jump, spring)
    if (jump) {
      // Applies the new place with no transition before transitions come back.
      void pill.offsetHeight
      pill.removeAttribute('data-instant')
    }
  }

  function placeAll(instant: boolean) {
    pillsRef.current.forEach((pill, i) => place(pill, i, instant))
  }

  function fitPress() {
    const list = listRef.current
    if (!list?.offsetWidth) return
    shrink.current = readCssNumber(getComputedStyle(list), `${name}-press-shrink`, 4)
    for (const option of options.values()) fitScale(option, option.offsetWidth)
    for (const { ref, target } of pillsRef.current) {
      const option = target === null ? undefined : options.get(target)
      if (ref.current && option) fitScale(ref.current, option.offsetWidth)
    }
  }

  // Watches the entries there are now: new ones, and none that have gone.
  function observeOptions() {
    const ro = observer.current
    if (!ro) return
    const current = new Set<Element>(options.values())
    for (const el of observed.current) {
      if (current.has(el)) continue
      ro.unobserve(el)
      observed.current.delete(el)
    }
    for (const el of current) {
      if (observed.current.has(el)) continue
      ro.observe(el)
      observed.current.add(el)
    }
  }

  useLayoutEffect(() => {
    pillsRef.current = pills
    placeAll(false)
    observeOptions()
  })

  useEffect(() => () => springs.stop(), [springs])

  // A ResizeObserver reports once as soon as it observes, so that fits the
  // press on mount too.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (typeof ResizeObserver === 'undefined') {
      fitPress()
      return
    }
    // One report for any number of elements resized at once.
    const ro = new ResizeObserver(() => {
      placeAll(true)
      fitPress()
    })
    const watching = observed.current
    observer.current = ro
    ro.observe(list)
    observeOptions()
    return () => {
      ro.disconnect()
      observer.current = null
      watching.clear()
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- placeAll, fitPress and observeOptions read only refs
  }, [])
}
