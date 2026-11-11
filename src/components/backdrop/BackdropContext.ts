import { createContext } from 'react'
import type { ReadablePage } from '../../contrast'
import type { Backdrop, OverlayBackdrop } from './backdrop'

/** The nearest GlassBackdrop, while it is drawing; null otherwise. */
export const BackdropContext = createContext<Backdrop | null>(null)

/**
 * The nearest GlassBackdrop, while it is drawing, for glass that lies over the
 * page; null otherwise. A popup clears BackdropContext for what it holds, but
 * not this, so a popup inside it has glass too.
 */
export const OverlayBackdropContext = createContext<OverlayBackdrop | null>(null)

/**
 * The colours of the page in the nearest GlassBackdrop, while they are known; null
 * otherwise. Its foreground is a var() that fades with the page (see pagePalette.ts).
 */
export const BackdropPaletteContext = createContext<ReadablePage | null>(null)
