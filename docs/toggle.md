# Toggle

[← Back to the README](../README.md)

An on/off switch: a glass track that looks sunk into the surface, and a round knob of clear glass that slides across as a tint fills the track. In right-to-left text it slides the other way. Pressing it presses the knob in, as a button is pressed. A disabled toggle has its fill and rim dimmed and its knob flat.

Its rim is a [button's](button.md), but lit softly from straight above, with no dark parts. The properties for this light, `--prism-toggle-rim-*`, are also used for every rim on a card, including a button's.

It is a `<button role="switch">` with `aria-checked`, so a click, a tap, Enter or the space bar switches it, and it defaults to `type="button"`. It has no label of its own: give it an `aria-label`, or put it in a `<label>` with its text; clicking the label switches it too:

```tsx
<label>
  Wi-Fi <Toggle checked={wifi} onChange={setWifi} />
</label>
```

Takes every `<button>` prop except `children`, including `ref`. An `onClick` that calls `preventDefault()` stops the toggle from switching. It also takes:

| Prop             | Default |                                                                               |
| ---------------- | ------- | ----------------------------------------------------------------------------- |
| `checked`        |         | Whether it is on. Left out, the toggle keeps track of its own state.          |
| `defaultChecked` | `false` | Whether it starts on, when `checked` is left out.                             |
| `onChange`       |         | Called with the new state, `(checked: boolean) => void`, when it is switched. |
| `refract`        | `true`  | Blurs what is behind the track and knob and bends it at their edges.          |

| Property                             | Default                   |                                                                                                                                       |
| ------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `--prism-toggle-width`               | `52px`                    | The track's width.                                                                                                                    |
| `--prism-toggle-height`              | `32px`                    | The track's height. The knob is a circle as wide as this, less `--prism-toggle-inset` on each side.                                   |
| `--prism-toggle-inset`               | `3px`                     | Space between the track's edge and the knob.                                                                                          |
| `--prism-toggle-track-bg`            | `#f3f4f6`                 | Colour of the track's tint (`#24272e` in dark mode).                                                                                  |
| `--prism-toggle-track-opacity`       | `0.3`                     | Opacity of the tint on the track.                                                                                                     |
| `--prism-toggle-track-shadow`        | groove shading            | Inset shadow inside the track's top edge.                                                                                             |
| `--prism-toggle-rim-light`           | `rgb(255 255 255 / 0.85)` | Colour of the rim along its top edge. Every rim on a card uses it too.                                                                |
| `--prism-toggle-rim-side`            | `rgb(255 255 255 / 0.5)`  | Colour of the rim halfway down each end.                                                                                              |
| `--prism-toggle-rim-bottom`          | `rgb(255 255 255 / 0.3)`  | Colour of the rim along its bottom edge.                                                                                              |
| `--prism-toggle-on-bg`               | `#6d7cff`                 | Colour that fills the track when the toggle is on.                                                                                    |
| `--prism-toggle-on-opacity`          | `0.75`                    | Opacity of that colour over the track.                                                                                                |
| `--prism-toggle-knob-bg`             | `#ffffff`                 | Colour of the knob's tint.                                                                                                            |
| `--prism-toggle-knob-opacity`        | `0.25`                    | Opacity of the tint on the knob (`0.18` in dark mode).                                                                                |
| `--prism-toggle-knob-hover-opacity`  | `0.35`                    | Opacity of the tint on the knob while the pointer is over the toggle (`0.26` in dark mode).                                           |
| `--prism-toggle-knob-sheen`          | faint diagonal gradient   | A background image over the knob's tint.                                                                                              |
| `--prism-toggle-knob-rim`            | highlights and a ring     | The curved highlights inside the knob's edge, and a hairline ring round it.                                                           |
| `--prism-toggle-knob-shadow`         | soft layers               | The knob's drop shadow.                                                                                                               |
| `--prism-toggle-knob-pressed-shadow` | tighter layers            | Its drop shadow while pressed.                                                                                                        |
| `--prism-toggle-press-halo`          | `rgb(17 19 24 / 0.3)`     | The soft dark halo round the knob while pressed.                                                                                      |
| `--prism-toggle-press-scale`         | `0.97`                    | Scale of the whole toggle while pressed. Not applied with `prefers-reduced-motion`.                                                   |
| `--prism-toggle-knob-press-scale`    | `0.9`                     | Scale of the knob while pressed, on top of the toggle's. Not applied with `prefers-reduced-motion`.                                   |
| `--prism-toggle-knob-stretch`        | `6px`                     | How much wider the knob gets while pressed, stretching towards the other end of the track. Not applied with `prefers-reduced-motion`. |
| `--prism-toggle-slide-duration`      | `300ms`                   | How long the knob takes to slide across, and the fill to fade.                                                                        |
| `--prism-toggle-slide-easing`        | ease-out                  | Easing of that slide. With `prefers-reduced-motion` the knob jumps across instead.                                                    |
| `--prism-toggle-focus`               | `#6d7cff`                 | Keyboard focus ring.                                                                                                                  |
| `--prism-toggle-disabled-opacity`    | `0.45`                    | Opacity of the fill and the rim while disabled.                                                                                       |

The track sets `--prism-refraction` to `20%`; the knob sets it to `30%`, with a `--prism-refraction-blur` of `2px`. On a press, the rim's light rotates by the button's `--prism-button-press-rim-turn` over `--prism-press-duration`, and rotates back over the button's `--prism-button-rim-release-duration`.
