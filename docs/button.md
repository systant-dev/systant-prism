# Button

[← Back to the README](../README.md)

A glass button: a pill at its usual height, with a card's corner radius, `--prism-card-radius`. Its glass is smoky (or pale, where the page's colours call for it; see [One set of colours for a page](colours.md#one-set-of-colours-for-a-page)) and blurs what is behind it without bending it. A soft glare follows the pointer across it. Pressing it makes it look pushed into the surface: it shrinks, its shadow tightens and the light on its rim rotates. `aria-pressed` gives it the look of a button that is held down. A disabled button lies flat, with its label and rim dimmed.

The rim is shaded as if lit from above left. On a card it is lit softly instead, with no dark parts, like a [toggle's](toggle.md).

Takes every `<button>` prop, including `ref`, and defaults to `type="button"`. It also takes:

| Prop           | Default     |                                                                                                                                   |
| -------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `variant`      | `'primary'` | `'secondary'` is clearer, flatter glass with dimmer light, for a lesser action beside the main one (Cancel next to Save).         |
| `blur`         | `true`      | Blurs what is behind the button.                                                                                                  |
| `glare`        | `true`      | Shows a soft glare that follows the pointer over the button, at a `--prism-glare-intensity` of `0.3`. A disabled button has none. |
| `readableText` | `true`      | Automatic text colour (see [Readable text colour](colours.md#readable-text-colour)).                                              |

| Property                              | Default                         |                                                                                                   |
| ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `--prism-button-bg`                   | `#111318`                       | Tint colour.                                                                                      |
| `--prism-button-glass-opacity`        | `0.3`                           | Opacity of the tint.                                                                              |
| `--prism-button-hover-opacity`        | `0.4`                           | Opacity of the tint on hover.                                                                     |
| `--prism-button-pressed-opacity`      | `0.55`                          | Opacity of the tint while pressed or `aria-pressed`.                                              |
| `--prism-button-fg`                   | `#ffffff`                       | Text colour.                                                                                      |
| `--prism-button-text-shadow`          | 1px halo in the text colour     | Smooths thin, light text on the glass; `none` turns it off.                                       |
| `--prism-button-font-family`          | the parent's                    | Label font.                                                                                       |
| `--prism-button-font-weight`          | the parent's                    | Label weight.                                                                                     |
| `--prism-button-letter-spacing`       | the parent's                    | Space between the label's letters.                                                                |
| `--prism-button-blur`                 | `10px`                          | Backdrop blur.                                                                                    |
| `--prism-button-rim-light`            | `rgb(255 255 255 / 0.75)`       | Colour of the rim's brightest part, round the top-left.                                           |
| `--prism-button-rim-shade`            | `rgb(0 0 0 / 0.35)`             | Colour of the rim's darker part, across the top-right.                                            |
| `--prism-button-rim-shade-bottom`     | `rgb(0 0 0 / 0.15)`             | Colour of the rim's darker part, across the bottom-left.                                          |
| `--prism-button-rim-bounce`           | `rgb(255 255 255 / 0.5)`        | Colour of the rim's dimmer bright part, round the bottom-right.                                   |
| `--prism-button-rim-angle`            | `-40deg`                        | Rotates the rim's light and shade.                                                                |
| `--prism-button-rim-width`            | `1px`                           | Rim thickness.                                                                                    |
| `--prism-button-highlight`            | `rgb(255 255 255 / 0.8)`        | Colour of the curved highlight just inside the rim, along the top and round the top-left.         |
| `--prism-button-bounce`               | `rgb(255 255 255 / 0.4)`        | Colour of the dimmer curved highlight along the bottom and round the bottom-right.                |
| `--prism-button-glint`                | top-left and bottom-right bevel | Inset shadow inside the rim, shown only round those two corners.                                  |
| `--prism-button-sheen`                | faint diagonal gradient         | A background image over the tint.                                                                 |
| `--prism-button-glow`                 | soft top line                   | Inset shadow inside the edge.                                                                     |
| `--prism-button-shadow`               | soft layers                     | Drop shadow.                                                                                      |
| `--prism-button-focus`                | `#6d7cff`                       | Keyboard focus ring.                                                                              |
| `--prism-button-disabled-opacity`     | `0.45`                          | Opacity of the label and the rim while disabled.                                                  |
| `--prism-button-pressed-shadow`       | tighter layers                  | Drop shadow while pressed.                                                                        |
| `--prism-button-press-halo`           | `rgb(17 19 24 / 0.5)`           | Colour of the soft dark halo all the way round the button while pressed.                          |
| `--prism-button-press-halo-blur`      | `32px`                          | How soft the halo is.                                                                             |
| `--prism-button-press-halo-spread`    | `-8px`                          | How far the halo's edge is inset from the button's. Keep it negative, or the button looks bigger. |
| `--prism-button-press-scale`          | `0.95`                          | Scale of the button while pressed. Not applied with `prefers-reduced-motion`.                     |
| `--prism-button-press-glint`          | `0.3`                           | Opacity of the glints while pressed, 0–1.                                                         |
| `--prism-button-press-rim-turn`       | `45deg`                         | How far the rim's light and shade rotate clockwise while pressed.                                 |
| `--prism-button-rim-release-duration` | `1400ms`                        | How long the rim's light takes to rotate back after a release.                                    |
| `--prism-button-rim-release-easing`   | strong ease-out                 | Easing of that rotation.                                                                          |
| `--prism-button-press-duration`       | `120ms`                         | How long the button takes to press in.                                                            |
| `--prism-button-press-easing`         | ease-out                        | Easing of the press.                                                                              |
| `--prism-button-release-duration`     | `420ms`                         | How long the button takes to spring back when released.                                           |
| `--prism-button-release-easing`       | ease-out                        | Easing of the release.                                                                            |

A secondary button has its own properties for its tint, shadow and highlights, so that they can be set once on an ancestor. A primary button's property set on an ancestor doesn't affect a secondary button; set on the secondary button itself, it does.

| Property                                   | Default                  |                                                                                     |
| ------------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------- |
| `--prism-button-secondary-glass-opacity`   | `0.12`                   | Opacity of the tint.                                                                |
| `--prism-button-secondary-hover-opacity`   | `0.25`                   | Opacity of the tint on hover.                                                       |
| `--prism-button-secondary-pressed-opacity` | `0.4`                    | Opacity of the tint while pressed or `aria-pressed`.                                |
| `--prism-button-secondary-shadow-opacity`  | `0.15`                   | Opacity of its drop shadow, at rest and pressed, 0–1.                               |
| `--prism-button-secondary-highlight`       | `rgb(255 255 255 / 0.4)` | Colour of the curved highlight along the top.                                       |
| `--prism-button-secondary-bounce`          | `rgb(255 255 255 / 0.2)` | Colour of the curved highlight along the bottom.                                    |
| `--prism-button-secondary-glint-opacity`   | `0.4`                    | Opacity of its glints at rest, 0–1. A press dims them as far as a primary button's. |
