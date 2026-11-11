# systant-prism

[![npm version](https://img.shields.io/npm/v/@systant/prism)](https://www.npmjs.com/package/@systant/prism)

Glass components for React 19.2 or later: cards, buttons, inputs, menus, a calendar, a data grid and animated backgrounds. Their surfaces are translucent, with rims and highlights that respond to the pointer, and inside a `GlassBackdrop` they blur and bend the image behind them.

```bash
npm install @systant/prism
```

```tsx
import { Button, Card, GlassBackdrop } from '@systant/prism'

export function Page() {
  return (
    <GlassBackdrop src="/background.webp" style={{ minHeight: '100vh' }}>
      <Card padding="lg">
        <Button>Hello</Button>
      </Card>
    </GlassBackdrop>
  )
}
```

Styles ship with the components: React 19 hoists each stylesheet into `<head>` once, so there is no CSS file to import.

## Components

Each component has its own page, with its props and custom properties.

| Component                                                                                 |                                                                                                                        |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`Card`](docs/card.md)                                                                    | A glass surface whose border lights up near the pointer.                                                               |
| [`CardGrid`](docs/card-grid.md)                                                           | A grid of cards that can be dragged into a new order, minimised and maximised.                                         |
| [`Button`](docs/button.md)                                                                | A glass button that presses into the surface, primary or secondary.                                                    |
| [`Toggle`](docs/toggle.md)                                                                | An on/off switch.                                                                                                      |
| [`Progress`](docs/progress.md), [`ProgressOverlay`](docs/progress.md#over-the-whole-page) | A loading ring, on its own or over the whole page.                                                                     |
| [`Textbox`](docs/textbox.md), [`Textarea`](docs/textarea.md)                              | Single-line and multi-line text inputs with a clear button.                                                            |
| [`Combobox`](docs/combobox.md)                                                            | A text field that filters a list, to select one entry or several.                                                      |
| [`Calendar`](docs/calendar.md)                                                            | A date field: type a date or a range of days, or pick from a month.                                                    |
| [`DataGrid`](docs/data-grid.md)                                                           | A grid for rows of JSON, from an array or an API: sorting, filtering, pages, editing, summaries and child collections. |
| [`Menu`, `MenuButton`](docs/menu.md)                                                      | A menu of actions, checkboxes, radio groups, sliders and submenus, and a button that opens one.                        |
| [`Popup`](docs/popup.md)                                                                  | A floating glass panel, above everything else on the page.                                                             |
| [`VerticalSelector`, `HorizontalSelector`](docs/selectors.md)                             | A list to pick one entry from, marked by a glass pill that glides to the selection.                                    |
| [`ScrollArea`](docs/scroll-area.md)                                                       | A scrolling box with thin glass scrollbars, whose content fades out at the edges.                                      |
| [`Fade`](docs/fade.md)                                                                    | A box that crossfades from its old content to its new.                                                                 |
| [`GlassBackdrop`](docs/glass-backdrop.md)                                                 | The page's background image, and the glass of everything inside it, drawn on the GPU.                                  |
| [`DynamicBackground`](docs/dynamic-background.md)                                         | A `GlassBackdrop` with an animated forest or ocean under the real sky.                                                 |

## Guides

| Guide                                                      |                                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [Theming](docs/theming.md)                                 | The custom properties that every component shares, and the easing curves.                |
| [Hooks](docs/hooks.md)                                     | The card's and button's effects, for your own elements.                                  |
| [Colours](docs/colours.md)                                 | Readable text and selection colours, and the one set of colours a backdrop gives a page. |
| [Content Security Policy](docs/content-security-policy.md) | A nonce for the stylesheets the components add.                                          |
| [Server rendering](docs/server-rendering.md)               | Passing the reader's language, the page's colours and day or night from a server.        |

## Browser support

Glass needs WebGPU, and there is no WebGL fallback. Current Chrome, Edge, Safari and Firefox have it, though not yet on every operating system and GPU, and only in a [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts): over HTTPS or on `localhost`, not plain HTTP. Where WebGPU isn't available, the page keeps its image as a CSS background and components have only their tint.

## Development

```bash
npm run dev          # demo at http://localhost:5180
npm test             # unit tests (npm run test:watch to watch)
npm run typecheck
npm run lint
npm run format
npm run gpu          # the backdrop on the real GPU, against HEAD (see below)
```

The scenes' shaders are only compiled by a real GPU, in a browser, so a shader the GPU rejects doesn't fail any unit test: `GlassBackdrop` just shows the scene's picture instead. `npm run gpu` builds every scene and the glass in a headless Chrome or Edge (or `CHROME_PATH`), renders forest, ocean and glass cases by day, dusk and night, in rain and held still, and compares each pixel for pixel with `src` as it is at `HEAD`. On one GPU the scenes are deterministic, so a change meant to look the same must match exactly; where one doesn't, a picture of the difference is saved under `.gpu-check/diffs`. `-- --against <ref>` compares with another commit, and `-- --against none` only builds and renders.

A pre-push hook in `.githooks` runs it on every branch pushed whose `src` has changed from the remote's, on the commit being pushed rather than the working tree. It stops the push if a scene won't build, the GPU reports an error or a render is black; pixels that differ are only reported, since a change may be intentional. Where it can't run (no Chrome or Edge, or no WebGPU) it allows the push, and `git push --no-verify` skips it. Turn it on once per clone:

```bash
git config core.hooksPath .githooks
```

`npm run gpu -- --pictures` renders `DynamicBackground`'s pictures of the scenes, at noon and at midnight on midsummer's day in London, and writes them to `src/components/dynamicBackground/pictures` (or `-- --out <dir>`), along with the page's colours in each, for `PAGE_IMAGES` in `pictures.ts`. Run it after moving a scene's camera, or where its sun, moon or stars are drawn.
