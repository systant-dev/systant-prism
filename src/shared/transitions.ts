/** Whether the transitions running on an element can be asked after at all: only with the Web Animations API. */
export function knowsTransitions(el: Element) {
  return typeof el.getAnimations === 'function'
}

/**
 * A CSS transition of one of `properties` running on the element itself, if one
 * is found: none where there is none, and none where they can't be asked after
 * (knowsTransitions says which). Reading getAnimations() brings the element's
 * style up to date first, so a transition a style change has just started is
 * there to be found.
 */
export function runningTransition(el: Element, properties: ReadonlySet<string>): CSSTransition | undefined {
  if (!knowsTransitions(el)) return undefined
  return el
    .getAnimations()
    .find(
      (a): a is CSSTransition => 'transitionProperty' in a && properties.has((a as CSSTransition).transitionProperty),
    )
}
