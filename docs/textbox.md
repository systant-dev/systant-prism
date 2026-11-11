# Textbox

[← Back to the README](../README.md)

A single-line text input shaped like a pill, with a clear button at its end. At rest it is flat: a plain tint and a 1px border. While the focus is inside it, the border becomes a softly lit rim, like a [toggle's](toggle.md), so the field looks sunk into the surface. That rim and the caret show the focus; it has no focus ring.

It takes an `<input>`'s props and passes them, `ref` included, to the input, so it can replace an `<input>` directly and `onChange` receives the usual event. `className` and `style` are applied to the outer pill instead, so that a width or a custom property affects the whole field. It has no label of its own: give it an `aria-label`, or put it in a `<label>` with its text. Its text has its own colour, chosen to suit the tint, rather than inheriting the colour around it.

```tsx
<label>
  Name <Textbox value={name} onChange={(event) => setName(event.target.value)} style={{ width: '100%' }} />
</label>
```

- The clear button edits the input as typing would: `onChange` is called with a real event, the focus stays on the input, and the browser's undo brings the text back. It is disabled when there is nothing to clear, and on a `disabled` or `readOnly` input. On `type="search"` it replaces the browser's own.
- On an uncontrolled textbox (one with no `value`), the clear button keeps up with the input's changes and its form's resets, but not with a value written to the element through a `ref`.
- When the input takes the focus, all its text is selected, so it can be typed over or copied; a second click places the caret.

It also takes:

| Prop                | Default   |                                                                                                              |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| `type`              | `'text'`  | `'text'`, `'search'`, `'email'`, `'url'`, `'tel'` or `'password'`. For a number, use `inputMode="numeric"`.  |
| `clearLabel`        | `'Clear'` | Accessible name of the clear button.                                                                         |
| `readableText`      | `true`    | Automatic text colour (see [Readable text colour](colours.md#readable-text-colour)).                         |
| `readableSelection` | `true`    | Automatic colours for selected text (see [Readable selection colour](colours.md#readable-selection-colour)). |

| Property                                 | Default                |                                                                                                                                                |
| ---------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `--prism-textbox-width`                  | `240px`                | The field's width. To change one field only, set `width` in its `style`.                                                                       |
| `--prism-textbox-height`                 | `40px`                 | The field's height.                                                                                                                            |
| `--prism-textbox-padding`                | `16px`                 | Space between the start of the field and its text.                                                                                             |
| `--prism-textbox-bg`                     | `#f3f4f6`              | Colour of the field's tint (`#24272e` in dark mode).                                                                                           |
| `--prism-textbox-opacity`                | `0.6`                  | Opacity of the tint.                                                                                                                           |
| `--prism-textbox-focus-opacity`          | `0.65`                 | Opacity of the tint while focused.                                                                                                             |
| `--prism-textbox-fg`                     | `#111318`              | Colour of the text and the clear icon (`#eceef2` in dark mode).                                                                                |
| `--prism-textbox-border`                 | `rgb(17 19 24 / 0.25)` | Colour of the border at rest (white at the same opacity in dark mode).                                                                         |
| `--prism-textbox-selection`              | `#6d7cff`              | Colour of the selection highlight outside a `GlassBackdrop` (`#9aa5ff` in dark mode).                                                          |
| `--prism-textbox-selection-fg`           | `#111318`              | Colour of selected text outside a `GlassBackdrop`. Black or white is used instead where that lets the highlight stay closer to its own colour. |
| `--prism-textbox-placeholder-opacity`    | `0.6`                  | Opacity of the placeholder text.                                                                                                               |
| `--prism-textbox-focus-shadow`           | groove shading         | Inset shadow inside the top edge while focused.                                                                                                |
| `--prism-textbox-focus-duration`         | `350ms`                | How long the focused edge takes to fade in.                                                                                                    |
| `--prism-textbox-blur-duration`          | `800ms`                | How long it takes to fade back to the plain border.                                                                                            |
| `--prism-textbox-separator`              | `rgb(17 19 24 / 0.2)`  | Colour of the separator before the clear button (white at the same opacity in dark mode).                                                      |
| `--prism-textbox-separator-height`       | `16px`                 | Height of the separator.                                                                                                                       |
| `--prism-textbox-clear-size`             | `34px`                 | The clear button's width. It is as tall as the field.                                                                                          |
| `--prism-textbox-clear-opacity`          | `0.65`                 | Opacity of the clear icon until it is hovered or focused.                                                                                      |
| `--prism-textbox-clear-disabled-opacity` | `0.3`                  | Opacity of the clear icon when there is nothing to clear.                                                                                      |
| `--prism-textbox-focus`                  | `#6d7cff`              | The clear button's keyboard focus ring.                                                                                                        |
| `--prism-textbox-disabled-opacity`       | `0.45`                 | Opacity of the whole textbox while disabled.                                                                                                   |

The focused rim's colours come from the toggle's `--prism-toggle-rim-*` properties, and `--prism-button-rim-width` sets the width of the border, the rim and the separator.
