# Content Security Policy

[← Back to the README](../README.md)

Each component adds its stylesheet to the page as a `<style>` element, and sets a few CSS variables through `style` attributes. Under a policy that names where styles may come from, the elements need `'unsafe-inline'` or a nonce. For a nonce, wrap the components in `StyleNonce`, and every stylesheet the library adds carries it:

```tsx
import { StyleNonce } from '@systant/prism'

;<StyleNonce value={nonce}>
  <App />
</StyleNonce>
```

That covers the stylesheets added in the browser. In server-rendered markup, React writes the stylesheets out itself and takes their nonce from its own render options (`nonce` in `renderToPipeableStream`). A nonce can't cover the `style` attributes, so the policy needs `style-src-attr 'unsafe-inline'` for them, which allows inline `style` attributes only, not stylesheets.
