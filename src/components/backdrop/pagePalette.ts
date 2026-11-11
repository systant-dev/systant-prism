// The one set of colours a GlassBackdrop's page is drawn in (readablePage,
// src/contrast), chosen from its image and the theme pairs its styles hold.
//
// The tint reaches every control through the tuning properties they already
// read: set on the backdrop, they beat the defaults on :root, and a control can
// still be given its own. What is drawn in a faint coat of the text's colour goes
// with it, so a border stays visible when a light theme's glass turns dark, and
// the horizontal selector's white pill thins on dark glass, as it does in a dark
// theme, for pale text to read on it, and a progress ring's light dims there, as
// white highlights show far more on dark glass than on pale. Text
// and selections are set by each control, which can opt out of them
// (useGlassText, useGlassSelection).
//
// Two numbers go with the colours. --_prism-page-glass is how thick the glass that
// lies straight on the image must be for the text to read, which a card, a popup
// and the horizontal selector's track take as the least their own tint may be: over
// an image dark below and light above, a card's 30% is not enough for either pair.
// --_prism-page-dimmest is how far text may be dimmed on that glass and still read,
// which a selector holds its idle entries to. Both fade with the colours.
//
// The text and tint are held in two private properties on the backdrop, which
// everything else refers to rather than holding a colour of its own. They are
// registered and transition there (backdrop.styles.ts), so when the page turns
// from one pair to the other, every tint, border and piece of text fades as one,
// from the one transition.
import { luminance, parseColor, readablePage, toRgba, type PageImage, type ReadablePage } from '../../contrast'
import { cssVars } from '../../shared'

/**
 * The page's text colour as given to controls (useGlassText): the property that
 * fades, so the text follows the tint instead of jumping ahead of it.
 */
export const PAGE_TEXT = 'var(--_prism-page-fg)'

/** The page's colours by the theme pairs in `computed`; null if any isn't a colour this can read. */
export function pagePalette(computed: CSSStyleDeclaration, image: PageImage): ReadablePage | null {
  const read = (property: string) => computed.getPropertyValue(`--prism-backdrop-${property}`).trim()
  const [foreground, background, alternateForeground, alternateBackground] = ['fg', 'bg', 'alt-fg', 'alt-bg'].map(read)
  if (![foreground, background, alternateForeground, alternateBackground].every(parseColor)) return null
  return readablePage(image, {
    theme: { foreground, background },
    alternate: { foreground: alternateForeground, background: alternateBackground },
    accent: parseColor(read('accent')) ? read('accent') : undefined,
  })
}

export function samePalette(a: ReadablePage | null, b: ReadablePage | null) {
  return (
    a?.foreground === b?.foreground &&
    a?.background === b?.background &&
    a?.glassOpacity === b?.glassOpacity &&
    a?.dimmest === b?.dimmest &&
    a?.selection.background === b?.selection.background &&
    a?.selection.color === b?.selection.color
  )
}

/** The tuning properties that carry the page's colours to everything inside the backdrop. */
export function paletteStyle({ foreground, background, glassOpacity, dimmest }: ReadablePage) {
  const coat = (percent: number) => `color-mix(in srgb, ${PAGE_TEXT} ${percent}%, transparent)`
  const tint = 'var(--_prism-page-bg)'
  // A page's colours given from outside may hold one that can't be read: that says which, rather than failing on nothing.
  const pale = luminance(toRgba(background)) > 0.5
  return cssVars({
    '--_prism-page-fg': foreground,
    '--_prism-page-bg': background,
    '--_prism-page-glass': glassOpacity,
    '--_prism-page-dimmest': dimmest,
    '--_prism-page-pill-opacity': pale ? 0.45 : 0.16,
    '--_prism-page-light': pale ? 1 : 0.6,
    '--prism-card-bg': tint,
    '--prism-button-bg': tint,
    '--prism-textbox-bg': tint,
    '--prism-toggle-track-bg': tint,
    '--prism-horizontal-selector-track-bg': tint,
    '--prism-progress-bg': tint,
    '--prism-progress-light': 'var(--_prism-page-light)',
    '--prism-horizontal-selector-glass-opacity': 'var(--_prism-page-pill-opacity)',
    '--prism-card-border': coat(10),
    '--prism-textbox-border': coat(25),
    '--prism-textbox-separator': coat(20),
    '--prism-scrollbar-thumb': coat(28),
    '--prism-scrollbar-thumb-hover': coat(45),
  })
}
