# Theming

[← Back to the README](../README.md)

Everything is adjusted with CSS custom properties. Set them on a component, or once on any ancestor (a theme root, for example). The defaults follow `prefers-color-scheme`. Each component's own properties are listed in its section; these are the card's, and the ones every component shares:

| Property                        | Default (light)          |                                                                                                                                                                     |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--prism-card-radius`           | `16px`                   | Corner radius. Corners are squircles where `corner-shape` is supported.                                                                                             |
| `--prism-card-bg`               | `#f3f4f6`                | Surface tint.                                                                                                                                                       |
| `--prism-card-glass-opacity`    | `0.3`                    | Opacity of the tint. Inside a `GlassBackdrop`, no lower than the page's text needs (see [One set of colours for a page](colours.md#one-set-of-colours-for-a-page)). |
| `--prism-card-fg`               | `#111318`                | Text colour.                                                                                                                                                        |
| `--prism-card-border`           | `rgb(17 19 24 / 0.1)`    | Colour of the 1px border.                                                                                                                                           |
| `--prism-card-shadow`           | three soft layers        | Drop shadow.                                                                                                                                                        |
| `--prism-card-sheen`            | top-edge inset           | The highlight along the top edge.                                                                                                                                   |
| `--prism-card-highlight`        | `#ffffff`                | Pointer highlight colour.                                                                                                                                           |
| `--prism-card-highlight-size`   | `280px`                  | Pointer highlight radius, in any length unit. Read when the card mounts.                                                                                            |
| `--prism-inner-sheen-color`     | `#ffffff`                | Inner sheen colour.                                                                                                                                                 |
| `--prism-inner-sheen-intensity` | `0.4`                    | Inner sheen opacity, 0–1.                                                                                                                                           |
| `--prism-inner-sheen-size`      | `180px`                  | How far along an edge the sheen reaches.                                                                                                                            |
| `--prism-inner-sheen-width`     | `24px`                   | How far in from the edge the sheen reaches.                                                                                                                         |
| `--prism-glare-color`           | `#ffffff`                | Glare colour.                                                                                                                                                       |
| `--prism-glare-intensity`       | `0.22`                   | Glare opacity, 0–1.                                                                                                                                                 |
| `--prism-glare-size`            | `90px`                   | Glare radius.                                                                                                                                                       |
| `--prism-glare-inset`           | `0px`                    | How far in from the edge the glare stops (a button sets its rim's width).                                                                                           |
| `--prism-light-fade-in`         | `250ms`                  | How long every pointer light (the glare, the inner sheen, the edge light) takes to fade in.                                                                         |
| `--prism-light-fade-out`        | `600ms`                  | How long they take to fade out.                                                                                                                                     |
| `--prism-glare-fade-in`         | `--prism-light-fade-in`  | How long the glare alone takes to fade in on hover.                                                                                                                 |
| `--prism-glare-fade-out`        | `--prism-light-fade-out` | How long it alone takes to fade out as the pointer leaves.                                                                                                          |
| `--prism-edge-light-color`      | `#ffffff`                | Edge light colour.                                                                                                                                                  |
| `--prism-edge-light-intensity`  | `0.9`                    | Edge light strength, 0–1.                                                                                                                                           |
| `--prism-edge-light-size`       | `120px`                  | Edge light radius along the edge.                                                                                                                                   |
| `--prism-edge-light-width`      | `1px`                    | Width of the ring of edge that it lights.                                                                                                                           |
| `--prism-refraction`            | `20%`                    | How strongly the edges bend what is behind, as a percentage of the card's shorter side. `0%` leaves only the blur.                                                  |
| `--prism-refraction-width`      | `auto`                   | How far in from the edge the bend reaches. `auto` follows the corner radius (at least 8px). At most a quarter of the card's shorter side.                           |
| `--prism-refraction-blur`       | `3px`                    | Backdrop blur.                                                                                                                                                      |
| `--prism-refraction-fade`       | `700ms`                  | How long the bend takes to fade in when the glass first shows. `0s` shows it at once.                                                                               |
| `--prism-refraction-soft`       | `0px`                    | How soft the glass's edges are. Must be set on the element itself.                                                                                                  |
| `--prism-refraction-hole`       | `0px`                    | The radius of a round hole through the middle of the glass, which makes the glass a ring. Must be set on the element itself.                                        |
| `--prism-refraction-frost`      | `0px`                    | The blur at the top of the glass, where the bend fades out going up. Use it only on small glass, as its cost grows with area. Must be set on the element itself.    |

Every component's animations use the same few easing curves, which each component's own easing properties refer to by default, so changing one curve changes it everywhere:

| Property                  | Default                          |                                                                                            |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `--prism-ease-out`        | `cubic-bezier(0.33, 1, 0.68, 1)` | Starts quickly and settles into place. Used for a press, a fade in, and a light appearing. |
| `--prism-ease-out-strong` | `cubic-bezier(0.22, 1, 0.36, 1)` | Like `--prism-ease-out`, with a longer finish. Used for a release, a glide, and a slide.   |
| `--prism-ease-out-long`   | `cubic-bezier(0.16, 1, 0.3, 1)`  | Stronger still. Used for the rim's light rotating back after a press.                      |
| `--prism-ease-in`         | `cubic-bezier(0.32, 0, 0.67, 0)` | Starts slowly and gathers pace. Used for things that disappear.                            |
| `--prism-ease-in-out`     | `cubic-bezier(0.65, 0, 0.35, 1)` | Gentle at both ends. Used for crossfades, and for lights fading out.                       |
