# VerticalSelector and HorizontalSelector

[← Back to the README](../README.md)

A list of entries to pick one from. A glass pill marks the selected entry and glides to a newly selected one, and a dimmer pill follows the pointer from entry to entry. `VerticalSelector` stacks its entries and has no background of its own; `HorizontalSelector` lays them out in a row inside its own glass track.

```tsx
import { HorizontalSelector } from '@systant/prism'

const [view, setView] = useState('week')

<HorizontalSelector
  aria-label="View"
  items={[
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month', disabled: true },
  ]}
  value={view}
  onChange={setView}
/>
```

It is a listbox of options. The arrow keys along its axis, Home and End move the selection, skipping disabled entries. A mouse or pen selects on press, as tabs do; a touch selects on release, so a swipe that starts on the list still scrolls the page.

Both take every `<div>` prop except `onChange` and `children`, including `ref`. They also take:

| Prop           | Default |                                                                                                      |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `items`        |         | The entries: `{ value, label, disabled? }`, the value a string and the label anything React renders. |
| `value`        |         | The selected entry's value. If it matches no entry, nothing is selected.                             |
| `onChange`     |         | Called with the value of the entry picked.                                                           |
| `refract`      | `true`  | Blurs what is behind the glass and bends it at its edges.                                            |
| `readableText` | `true`  | Automatic text colour (see [Readable text colour](colours.md#readable-text-colour)).                 |

Each has its own custom properties, `--prism-vertical-selector-…` and `--prism-horizontal-selector-…`, with the same endings:

| Ending                              | Vertical         | Horizontal       |                                                                                                                                     |
| ----------------------------------- | ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `-padding`                          | `10px 16px`      | `8px 18px`       | Each entry's padding.                                                                                                               |
| `-gap`                              | `2px`            | `4px`            | The gap between entries.                                                                                                            |
| `-idle-opacity`                     | `0.85`           | `0.8`            | Opacity of the text of an entry that isn't selected. Inside a `GlassBackdrop`, no lower than is still readable on the page's glass. |
| `-glass`, `-glass-opacity`          | `#fff`, `0.16`   | `#fff`, `0.45`   | Colour of the selection pill's tint, and its opacity.                                                                               |
| `-hover-opacity`                    | `0.5`            | `0.45`           | Opacity of the pill that follows the pointer.                                                                                       |
| `-glide-duration`, `-glide-easing`  | `400ms`          | `400ms`          | Duration and easing of the selection pill's glide to a newly selected entry.                                                        |
| `-appear-delay`, `-appear-duration` | `120ms`, `450ms` | `120ms`, `450ms` | Delay and duration of the selection pill's fade in once the layout has settled.                                                     |
| `-focus`                            | `#6d7cff`        | `#6d7cff`        | The focus ring.                                                                                                                     |

The horizontal selector's track has its own properties too, including `--prism-horizontal-selector-track-bg`, `-track-opacity` and `--prism-horizontal-selector-inset`; `HorizontalSelector.styles.ts` lists them all.
