# Colours

How the components keep their text and selected text readable, and how a `GlassBackdrop` gives a page one set of colours. The functions they use are exported, for elements of your own.

[← Back to the README](../README.md)

## Readable text colour

`readableForeground` picks a text colour for a background by WCAG 2.2's contrast rules: 4.5:1 for body text and 3:1 for large text at AA, 7:1 and 4.5:1 at AAA. Of the colours it may choose from (black and white unless you pass `candidates`), it takes the one with the most contrast:

```ts
import { readableForeground } from '@systant/prism'

readableForeground('#2563eb') // { color: '#ffffff', ratio: 5.168…, target: 4.5, passes: true }
readableForeground('#2563eb', { level: 'AAA', large: true })
readableForeground('#ffffff', { candidates: ['#111318', '#eceef2'] })
```

Glass is translucent, so its own colour doesn't tell you what the text actually sits on. A translucent background is therefore composited over each colour in `backdrop`, and the text must be readable over every one of them. Pass the lightest and darkest colours in your image. If you pass none, the text must be readable over both white and black, which is impossible on a faint tint like a card's, and `passes` reports that.

```ts
readableForeground('rgb(243 244 246 / 0.3)', { backdrop: ['#0f172a', '#334155'] }) // white
```

| Option       |                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `level`      | `'AA'` (default) or `'AAA'`.                                                                                                                                 |
| `large`      | Large text: 24px, or 18.66px bold. `isLargeText(px, weight)` tells you.                                                                                      |
| `minRatio`   | A contrast ratio to meet instead of the level's, for extra margin over busy images.                                                                          |
| `candidates` | The colours to choose from.                                                                                                                                  |
| `prefer`     | A colour you would like to use, such as a brand colour. It is used if it passes; otherwise it is darkened or lightened just enough to pass, keeping its hue. |
| `backdrop`   | The colours that may be behind a translucent background.                                                                                                     |

The background can also be given as a list of the colours it might be, such as a gradient's stops; the text is then judged by its worst contrast across them. When nothing passes, it returns the best available colour, so check `passes`.

`useReadableForeground` does the same for an element, using what is actually painted behind it: its own background colour and its ancestors', composited together down to the first opaque one. If it reaches a background image (or a `GlassBackdrop`, whose image it can't read), `backdrop` is used in its place. It recomputes when the options or the colour scheme change, or when a `class`, `style` or `data-theme` attribute changes on the element or an ancestor:

```tsx
function Caption({ children }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const readable = useReadableForeground(ref, { backdrop: ['#1e293b', '#cbd5e1'] })
  return (
    <p ref={ref} style={{ color: readable?.color }}>
      {children}
    </p>
  )
}
```

Every component with text does this for itself (`readableText`, on by default):

- **Inside a `GlassBackdrop`**, they all use the page's text colour (see [One set of colours for a page](#one-set-of-colours-for-a-page)).
- **On an opaque background**, each keeps its theme colour (`--prism-card-fg`, `--prism-button-fg`, `--prism-textbox-fg`, `--prism-horizontal-selector-fg`) wherever that is readable. Where it isn't, the colour is darkened or lightened just enough to be readable or, if that is impossible, replaced by black or white.
- **On translucent glass with no image behind it**, what shows through is unknown, so the theme colour is kept.

The page's text colour is checked on glass, over the image from the 2nd percentile of its luminance to the 98th. Text placed directly on the image can therefore fall short of 4.5:1, and so can text on glass over the darkest or lightest 2% of the image, such as the sun. Where it matters, put that text on glass, or on glass with a stronger tint.

## Readable selection colour

`readableSelection` picks a highlight colour for selected text, and the colour of the text on it. It has to meet two contrast ratios: the text on it must be readable, as for `readableForeground`, and the highlight must stand out from the background around it, by WCAG 2.2's 3:1 for non-text contrast.

```ts
import { readableSelection } from '@systant/prism'

readableSelection('#ffffff', { prefer: '#6d7cff', text: '#111318' })
// { background: '#6d7cff', color: '#111318', ratio: 5.3…, target: 4.5, separation: 3.5…, separationTarget: 3, passes: true }
```

The `prefer`red colour is darkened or lightened just enough to pass. The text colour is the one that gives way: of the `text` colour and the `candidates`, the one that lets the highlight stay closest to the preferred colour is used. When nothing meets both ratios, it returns the closest it can get, so check `passes`.

| Option          |                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `level`         | `'AA'` (default) or `'AAA'`, for the text on the highlight.                                                           |
| `large`         | Large text.                                                                                                           |
| `minRatio`      | A ratio for the text to meet instead of the level's.                                                                  |
| `minSeparation` | The ratio the highlight must have against the background. Default `3`.                                                |
| `prefer`        | The colour to keep the highlight close to. Default `#6d7cff`.                                                         |
| `text`          | The preferred colour for selected text. A candidate is used instead if it lets the highlight stay closer to `prefer`. |
| `candidates`    | The other text colours to try. Default black and white.                                                               |
| `backdrop`      | The colours that may be behind a translucent background. Default white and black.                                     |

`Textbox`, `Textarea`, `Combobox` and `Calendar` do this for themselves (`readableSelection`, on by default):

- **Inside a `GlassBackdrop`**, they all use the page's highlight: a shade of the image's dominant colour or, if the image has too little colour, as a greyscale photo does, of `--prism-backdrop-accent`.
- **Elsewhere**, each field works out its own highlight from `--prism-textbox-selection`. It doesn't know what is behind it, so the highlight has to work over both white and black, which can move it further from the colour you set.

## One set of colours for a page

Inside a `GlassBackdrop` the image sets the colours of the whole page: one text colour, one tint for all the glass, and one highlight for selected text. They are read once from the whole image, so no two controls on a page disagree, and they change with the image and the theme, fading over `--prism-fade-background-duration`.

No single text colour is readable on every tint, so the text colour and the tint are chosen as a pair:

- Each pair is checked over the image from its dark end to its light end: the 2nd and 98th percentiles of its luminance, and the three quartiles between them. The check finds the lowest tint opacity, starting from a card's 30%, at which the pair's text meets WCAG AA over all five.
- The pair that needs the lower opacity is used: the theme's pair, `--prism-backdrop-fg` on `--prism-backdrop-bg`, or the opposite pair, `--prism-backdrop-alt-fg` on `--prism-backdrop-alt-bg`. So a dark photo in a light theme gets dark glass.
- If that opacity is higher than 30%, the glass that lies directly on the image is made that opaque. `Card`, `Popup` and the horizontal selector's track use it as the minimum for their own opacity (`--prism-card-glass-opacity`, `--prism-popup-glass-opacity`, `--prism-horizontal-selector-track-opacity`), so a higher value of your own still applies.
- Dimmed text, such as a selector's unselected entries, is dimmed only as far as it still meets AA on that glass.

The backdrop sets the tint on itself through each control's usual custom property (`--prism-card-bg`, `--prism-button-bg`, `--prism-textbox-bg`, `--prism-toggle-track-bg`, `--prism-horizontal-selector-track-bg`). So a value for one of these set on `:root` has no effect inside a `GlassBackdrop`: to override one, set it on the control itself or in the backdrop's `style`.

The colours are read from the image on the GPU once it has been drawn. Until then, and wherever there is no WebGPU, the page uses the theme's own colours. To have the image's colours from the start, work them out in advance and pass them as `pageImage` (see [Server rendering](server-rendering.md)).

`readablePage` is the function that makes this choice, if you want the same colours somewhere else:

```ts
import { readablePage } from '@systant/prism'

readablePage(
  { tones: ['#447eaf', '#6195ba', '#b0cad8'], range: ['#246ca6', '#e5e7e8'], dominant: '#4b8ab6' },
  {
    theme: { foreground: '#111318', background: '#f3f4f6' },
    alternate: { foreground: '#eceef2', background: '#24272e' },
  },
)
// { foreground: '#111318', background: '#f3f4f6', glassOpacity: 0.3, dimmest: 0.82,
//   selection: { background: '#3c6e92', color: '#eceef2', … } }
```

The first argument is what `samplePicture` returns: `tones` are the image's quartiles by luminance, `range` its 2nd and 98th percentiles (optional), and `dominant` its dominant colour or `null`. In the result, `glassOpacity` is the tint opacity the text needs, and `dimmest` is the lowest opacity at which text on that glass still meets the level.

| Option         |                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `theme`        | The pair to use if its text is readable.                                                                                 |
| `alternate`    | The pair to switch to if it isn't.                                                                                       |
| `accent`       | The colour the highlight is based on when the image has no dominant colour.                                              |
| `level`        | `'AA'` (default) or `'AAA'`.                                                                                             |
| `glassOpacity` | Opacity of the tint on the faintest glass that has text on it, which the result can only raise. Default `0.3`, a card's. |
| `fieldOpacity` | Opacity of a field's tint. Default `0.6`, a textbox's.                                                                   |

| Property                            | Default   |                                                                                                    |
| ----------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| `--prism-backdrop-fg`               | `#111318` | The theme's text colour (`#eceef2` in dark mode).                                                  |
| `--prism-backdrop-bg`               | `#f3f4f6` | The theme's glass tint (`#24272e` in dark mode).                                                   |
| `--prism-backdrop-alt-fg`           | `#eceef2` | The text colour the page switches to (`#111318` in dark mode).                                     |
| `--prism-backdrop-alt-bg`           | `#24272e` | The glass tint the page switches to (`#f3f4f6` in dark mode).                                      |
| `--prism-backdrop-accent`           | `#6d7cff` | The highlight colour used for an image with too little colour of its own (`#9aa5ff` in dark mode). |
| `--prism-backdrop-page-in-duration` | `200ms`   | How long the page's content takes to fade in after the first scene has faded in.                   |

### The arithmetic underneath

The functions those three are built on are exported too, for checks of your own:

| Function                       |                                                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseColor(css)`              | A CSS colour as `{ r, g, b, alpha }`, or null if it isn't one. Any colour the browser can paint is read, which needs a DOM for named colours, `oklch()` and the like.                                      |
| `luminance(rgb)`               | WCAG relative luminance: 0 for black, 1 for white.                                                                                                                                                         |
| `contrastRatio(a, b)`          | The WCAG contrast ratio between two opaque colours, from 1 to 21.                                                                                                                                          |
| `minContrast(level, large)`    | The minimum contrast ratio WCAG 2.2 requires for text: 4.5 at `'AA'` (3 for large text), 7 at `'AAA'` (4.5 for large).                                                                                     |
| `backgroundBehind(el, until?)` | The background behind an element's text as a single colour: its own background and its ancestors', composited together. The result is translucent if an image, or a colour it can't read, lies underneath. |
