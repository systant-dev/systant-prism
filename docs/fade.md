# Fade

[← Back to the README](../README.md)

A box that crossfades from its old content to its new content when the content is replaced. Give it a `contentKey` that identifies what it is showing, and change the key and the content together; while the key stays the same, the content just updates in place. How it fades depends on its `mode`:

- `layer` (the default), for something like a page that changes with a menu selection: the old content fades out quickly, and the new content starts fading in just before the old has gone.
- `background`, for a background: the new content fades in over the old, which stays fully visible underneath until it is covered.

```tsx
<Fade contentKey={page.id}>
  <page.Component key={page.id} />
</Fade>

<Fade mode="background" contentKey={image} style={{ position: 'fixed', inset: 0, zIndex: -1 }}>
  <div style={{ background: `url(${image}) center / cover` }} />
</Fade>
```

A change made in the middle of a fade is handled: the latest key always ends up showing. Content that is fading out is inert. The box is a one-cell grid as big as its largest content, and the content fills it; don't set a `display` of your own on it.

Takes every `<div>` prop, including `ref`. It also takes:

| Prop         | Default   |                                                                            |
| ------------ | --------- | -------------------------------------------------------------------------- |
| `contentKey` |           | Identifies the content. When it changes, the box fades to the new content. |
| `mode`       | `'layer'` | `'layer'` or `'background'`, as above.                                     |

| Property                           | Default  |                                                                                                                                         |
| ---------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `--prism-fade-out-duration`        | `150ms`  | `layer`: how long the old content takes to fade out.                                                                                    |
| `--prism-fade-out-easing`          | ease-in  | Easing of that fade.                                                                                                                    |
| `--prism-fade-in-duration`         | `200ms`  | `layer`: how long the new content takes to fade in.                                                                                     |
| `--prism-fade-in-easing`           | ease-out | Easing of that fade.                                                                                                                    |
| `--prism-fade-overlap`             | `60ms`   | `layer`: how long before the old content has finished fading out the new content starts to fade in.                                     |
| `--prism-fade-background-duration` | `450ms`  | `background` mode, and the image and page colours of a `GlassBackdrop`: how long the new content takes to fade in, with an ease-in-out. |
