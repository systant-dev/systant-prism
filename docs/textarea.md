# Textarea

[← Back to the README](../README.md)

A multi-line [Textbox](textbox.md), with the same look and the same clear button, level with the first line. It has a scrollbar below the clear button, and a handle in the bottom corner that resizes it.

It takes a `<textarea>`'s props and passes them, `ref` included, to the textarea. `className` and `style` are applied to the outer element instead. It has no label of its own: give it an `aria-label`, or put it in a `<label>` with its text.

```tsx
<label>
  Notes <Textarea rows={6} value={notes} onChange={(event) => setNotes(event.target.value)} style={{ width: '100%' }} />
</label>
```

- **Resizing.** Drag the handle, or focus it and use the arrow keys, which resize it 16px at a time. It can't be made smaller than `--prism-textarea-min-width` by `--prism-textarea-min-height`, or wider than its container (which needs a width of its own, not one that comes from its content). Once resized, its size overrides a `width` or `height` in its `style`. A read-only textarea can be resized; a disabled one can't.
- **Focus.** Unlike a textbox, it doesn't select its text when it takes the focus.
- **Scrolling.** The scrollbar takes no width from the text, so the text doesn't re-wrap when it starts to overflow. It is styled by the [ScrollArea](scroll-area.md)'s `--prism-scrollbar-*` properties. With less than 32px of room it is hidden, and where scrollbars overlay the content, as on macOS and phones, the browser's own is used.

It also takes:

| Prop                | Default    |                                                   |
| ------------------- | ---------- | ------------------------------------------------- |
| `rows`              | `5`        | Its height in lines of text, until it is resized. |
| `clearLabel`        | `'Clear'`  | Accessible name of the clear button.              |
| `resizeLabel`       | `'Resize'` | Accessible name of the resize handle.             |
| `readableText`      | `true`     | The same as on a Textbox.                         |
| `readableSelection` | `true`     | The same as on a Textbox.                         |

The `--prism-textbox-*` properties apply to it too, along with these:

| Property                       | Default |                                                                   |
| ------------------------------ | ------- | ----------------------------------------------------------------- |
| `--prism-textarea-width`       | `320px` | Its starting width, or its container's width if that is narrower. |
| `--prism-textarea-height`      | `auto`  | Its starting height. `auto` takes it from `rows`.                 |
| `--prism-textarea-min-width`   | `160px` | The narrowest it can be resized to.                               |
| `--prism-textarea-min-height`  | `72px`  | The shortest it can be resized to.                                |
| `--prism-textarea-radius`      | `20px`  | Its corner radius.                                                |
| `--prism-textarea-line-height` | `20px`  | The text's line height.                                           |
| `--prism-textarea-resize-size` | `24px`  | The resize handle's width and height.                             |
