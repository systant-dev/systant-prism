import '@fontsource-variable/outfit'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Rendered once Outfit has loaded, so the page isn't laid out in the fallback
// font first and shifted as Outfit swaps in. A font that is slow to come only
// holds it up so long.
Promise.race([
  document.fonts.load('300 1em "Outfit Variable"'),
  new Promise((resolve) => setTimeout(resolve, 1000)),
]).then(render, render)
