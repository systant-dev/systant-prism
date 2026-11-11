# Combobox

[← Back to the README](../README.md)

A text field with a list of entries: type to filter the list, then select any number of entries, or just one with `multiple={false}`. It is a [Textbox](textbox.md)'s pill with a chevron at its end, and a `Popup` under it holding the list, where each selected entry is marked with a tick.

```tsx
const fruit = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry', disabled: true },
]

const [picked, setPicked] = useState<string[]>([])

<label>
  Fruit <Combobox items={fruit} value={picked} onChange={setPicked} placeholder="Pick some fruit" />
</label>
```

- **Filtering.** Typing opens the list and filters it to the entries whose labels contain the typed text, ignoring case and accents, with those that start with it first. The first match is the active entry, so Enter selects it. A press on the field or the chevron also opens the list, and the up and down arrow keys open it and move through the entries. Escape, a press elsewhere, or the field losing focus closes it.
- **Several entries.** Selecting an entry leaves the list open and selects the typed text, so that typing replaces it. When the field isn't focused, its text is the labels of the selected entries, in the order of `items`; while it is focused, those labels are its placeholder. The clear button clears the typed text or, if nothing is typed, the selection.
- **One entry.** With `multiple={false}`, picking an entry replaces the previous one and closes the list, and the field shows the selected entry's label, even while focused. `value` and `onChange` still use arrays, holding one value or none. If `onCommitText` is given, it is called with the typed text when Enter is pressed with no active entry, or the field loses focus, without an entry having been picked, which lets the field accept a value that isn't in the list.
- **Custom matching.** `match` returns the entries to list for the typed text (`''` when nothing is typed), replacing the built-in filtering, for a list that is computed rather than filtered. Its entries needn't be in `items`, but the field can only show a selected value's label if `items` has an entry for it.

It takes an `<input>`'s props and passes them, `ref` included, to the input, with these exceptions: `className` and `style` are applied to the outer pill, and `name` isn't accepted, because the field holds several values rather than the text it shows. It has no label of its own: give it an `aria-label`, or put it in a `<label>` with its text. It also takes:

| Prop                | Default        |                                                                                                                                   |
| ------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `items`             |                | The entries, each a `value`, a `label` to show and match against, and optionally `disabled`.                                      |
| `match`             |                | Returns the entries to list for the typed text, replacing the built-in filtering of `items`.                                      |
| `onCommitText`      |                | With `multiple` false: called with the typed text when Enter is pressed, or the field loses focus, without an entry being picked. |
| `multiple`          | `true`         | Whether several entries can be selected.                                                                                          |
| `value`             |                | The selected values; at most one when `multiple` is false. Left out, the combobox keeps track of the selection itself.            |
| `defaultValue`      | `[]`           | The values selected at first, when `value` is left out.                                                                           |
| `onChange`          |                | Called with all the selected values, in the order they were picked.                                                               |
| `noMatchesLabel`    | `'No matches'` | The text shown in the list when nothing matches.                                                                                  |
| `clearLabel`        | `'Clear'`      | Accessible name of the clear button.                                                                                              |
| `refract`           | `true`         | Glass effect on the list: inside a `GlassBackdrop`, blurs the backdrop image and bends it at the edges.                           |
| `readableText`      | `true`         | Automatic text colour (see [Readable text colour](colours.md#readable-text-colour)).                                              |
| `readableSelection` | `true`         | Automatic colours for selected text (see [Readable selection colour](colours.md#readable-selection-colour)).                      |

| Property                            | Default |                                               |
| ----------------------------------- | ------- | --------------------------------------------- |
| `--prism-combobox-max-height`       | `240px` | The tallest the list gets before it scrolls.  |
| `--prism-combobox-option-height`    | `36px`  | Minimum height of an entry.                   |
| `--prism-combobox-option-radius`    | `10px`  | Corner radius of an entry's highlight.        |
| `--prism-combobox-active-opacity`   | `0.12`  | Opacity of the highlight on the active entry. |
| `--prism-combobox-disabled-opacity` | `0.45`  | Opacity of a disabled entry.                  |
| `--prism-combobox-empty-opacity`    | `0.7`   | Opacity of the "no matches" line.             |

The field is styled by the `--prism-textbox-*` properties, except `--prism-textbox-clear-size`, and the panel by the `--prism-popup-*` properties.
