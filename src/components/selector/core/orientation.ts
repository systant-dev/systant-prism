export type Orientation = 'vertical' | 'horizontal'

/** What differs between laying a selector's entries out down or across. */
export interface Axis {
  /** The suffixes of the custom properties a pill is placed by: its offset and its size along the axis. */
  offsetProperty: 'y' | 'x'
  sizeProperty: 'height' | 'width'
  /** An entry's offset and size along the axis, in px. */
  measure: (el: HTMLElement) => { offset: number; size: number }
  /** A CSS translate that moves `offset` along the axis. */
  translate: (offset: string) => string
  /** The keys that step to the previous and the next entry, in a list whose text runs `rtl` or not. */
  steps: (rtl: boolean) => { back: string; forward: string }
}

export const axes: Record<Orientation, Axis> = {
  vertical: {
    offsetProperty: 'y',
    sizeProperty: 'height',
    measure: (el) => ({ offset: el.offsetTop, size: el.offsetHeight }),
    translate: (offset) => `0 ${offset}`,
    steps: () => ({ back: 'ArrowUp', forward: 'ArrowDown' }),
  },
  horizontal: {
    offsetProperty: 'x',
    sizeProperty: 'width',
    measure: (el) => ({ offset: el.offsetLeft, size: el.offsetWidth }),
    translate: (offset) => `${offset} 0`,
    // Right to left the entries run leftwards, so the next one is on the left.
    steps: (rtl) => (rtl ? { back: 'ArrowRight', forward: 'ArrowLeft' } : { back: 'ArrowLeft', forward: 'ArrowRight' }),
  },
}
