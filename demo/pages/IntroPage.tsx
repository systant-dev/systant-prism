import { TextPage } from '../layout'

export function IntroPage() {
  return (
    <TextPage title="Introduction">
      <p style={{ marginTop: 0 }}>
        systant-prism is a library of glass components for React: cards, buttons, menus, selectors, text boxes, a
        calendar, a data grid and others. Each one is a translucent surface that blurs and bends what is behind it, with
        a border that lights up near the pointer. The library also includes the animated background behind this page: a
        forest or an ocean, drawn on the GPU, under a sky that follows the time of day.
      </p>
      <p>
        The project is an experiment in using Claude, Anthropic's AI, to build a component library. It is influenced by
        Apple's Liquid Glass and by{' '}
        {/* The card's own text colour, which is kept readable on the glass; a link's default blue is not */}
        <a href="https://github.com/noniv/web-ocean" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          noniv/web-ocean
        </a>
        , a real-time ocean renderer for WebGPU.
      </p>
      <p style={{ marginBottom: 0 }}>
        Choose a component from the menu on the left to see its demos and its properties. The cog beside the title
        changes the background, turns its animation and rain on or off, and sets its time of day.
      </p>
    </TextPage>
  )
}
