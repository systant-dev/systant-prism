# CardGrid

[← Back to the README](../README.md)

A grid of cards that can be rearranged, laid out in as many columns as fit. Each card has a header with its title and two icon buttons, minimise and maximise, and its content below.

- **Drag** a card by its header to move it: the others slide out of the way, and it settles with a small spring when dropped. Escape cancels the drag. With a card's title focused, the arrow keys move the card: left and right by one place, up and down by a row.
- **Minimise** sends a card to a tray above the grid, where it becomes a chip; pressing the chip brings the card back. The tray looks like a [`HorizontalSelector`](selectors.md)'s track and uses its custom properties, which can be set on the grid.
- **Maximise**, or a double-click on the header, makes the card fill the grid while the others fade out; its body scrolls if the content doesn't fit. Enter or Space on a card's title does the same.

```tsx
<CardGrid
  style={{ minHeight: 520 }}
  items={[
    { id: 'revenue', title: 'Revenue', content: <Revenue /> },
    { id: 'visitors', title: 'Visitors', content: <Visitors /> },
  ]}
/>
```

Minimised cards, and the cards hidden while another is maximised, stay mounted, so their content keeps its state. Give the grid a `min-height` rather than a `height`, so that a maximised card has room: cards never shrink to fit a fixed height, so to scroll the grid, put it in a scroller. With `prefers-reduced-motion`, cards go straight to their places, with no spring.

Takes every `<div>` prop, including `ref`, plus:

| Prop             | Default                                                                         |                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`          |                                                                                 | The cards: `{ id, title, content, label? }`. `label` is the accessible name of the card and its buttons, needed when `title` isn't a string.                                                                                              |
| `layout`         |                                                                                 | `{ order, minimised, maximised }`: the card ids in order, the ids of the minimised cards, and the id of the maximised card or `null`. Left out, the grid keeps track of its own layout.                                                   |
| `defaultLayout`  |                                                                                 | The layout at first, when `layout` is left out. Cards that its `order` doesn't list go at the end.                                                                                                                                        |
| `onLayoutChange` |                                                                                 | Called with the new layout whenever it changes. Useful for saving the layout.                                                                                                                                                             |
| `columns`        |                                                                                 | The number of columns, all the same width. Left out, there are as many as fit, each at least `--prism-card-grid-column` wide.                                                                                                             |
| `rows`           |                                                                                 | The number of rows, all the same height. They share the grid's height equally (give the grid a `height` or `min-height`), but a row is never shorter than its cards, and more rows are added if there are more cards than rows × columns. |
| `padding`        | `'md'`                                                                          | Padding of each card's body: `'none'`, `'sm'`, `'md'` or `'lg'`.                                                                                                                                                                          |
| `trayLabel`      | `'Minimised cards'`                                                             | Accessible name of the tray.                                                                                                                                                                                                              |
| `minimiseLabel`  | `` (title) => `Minimise ${title}` ``                                            | Accessible name of a card's minimise button.                                                                                                                                                                                              |
| `maximiseLabel`  | `` (title) => `Maximise ${title}` ``                                            | Accessible name of a card's maximise button.                                                                                                                                                                                              |
| `restoreLabel`   | `` (title) => `Restore ${title}` ``                                             | Accessible name of a minimised card's chip.                                                                                                                                                                                               |
| `movedLabel`     | `` (title, place, places) => `${title} moved to place ${place} of ${places}` `` | What a screen reader announces when the arrow keys move a card.                                                                                                                                                                           |
| `readableText`   | `true`                                                                          | Automatic text colour, for the cards and the tray's chips (see [Readable text colour](colours.md#readable-text-colour)).                                                                                                                  |

| Property                            | Default            |                                                                                            |
| ----------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `--prism-card-grid-column`          | `280px`            | Minimum width of a column.                                                                 |
| `--prism-card-grid-gap`             | `16px`             | Space between the cards. The space between the tray and the grid is half of it by default. |
| `--prism-card-grid-duration`        | `350ms`            | How long cards take to slide to a new place, and to fade.                                  |
| `--prism-card-grid-easing`          | ease-out-strong    | Easing of that slide.                                                                      |
| `--prism-card-grid-lifted-shadow`   |                    | Shadow of a card while it is dragged.                                                      |
| `--prism-card-grid-spring`          | `6px`              | How far a dropped card overshoots its place as it springs. `0px` turns the spring off.     |
| `--prism-card-grid-spring-duration` | `900ms`            | How long the spring takes to settle.                                                       |
| `--prism-card-grid-under-blur`      | `6px`              | The blur of a card that is completely under a dragged one.                                 |
| `--prism-card-grid-under-shade`     | `rgb(0 0 0 / 0.2)` | The tint over a card that is completely under a dragged one.                               |
