import { useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Button, Card, Popup } from '../../src'
import { Copy, DemoPage, Section } from '../layout'

// A button that opens a popup beside it and closes it again.
function PopupButton({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & Omit<ComponentProps<typeof Popup>, 'open' | 'anchor'>) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button ref={ref} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
      </Button>
      <Popup open={open} onClose={() => setOpen(false)} anchor={ref} {...props}>
        {children}
      </Popup>
    </>
  )
}

// A card that opens a popup at the pointer on right-click. The point is kept
// while the popup fades out, so it doesn't jump as it closes.
function AtPointDemo() {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState({ x: 0, y: 0 })
  return (
    <Card
      onContextMenu={(event) => {
        event.preventDefault()
        setAt({ x: event.clientX, y: event.clientY })
        setOpen(true)
      }}
      style={{ minHeight: 160 }}
    >
      <Copy title="At a point">
        Right-click anywhere in this card. <code>anchor</code> can be a point instead of an element: the popup opens
        with its corner at the pointer, and flips to stay inside the window. For a menu of actions, use a Menu, which is
        built on this.
      </Copy>
      <Popup open={open} onClose={() => setOpen(false)} anchor={at} padding="md">
        <p style={{ margin: '0 0 12px' }}>
          Opened at {Math.round(at.x)}, {Math.round(at.y)}.
        </p>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Close
        </Button>
      </Popup>
    </Card>
  )
}

const sides = ['top', 'right', 'bottom', 'left'] as const

export function PopupPage() {
  return (
    <DemoPage
      name="Popup"
      intro={
        <p style={{ marginTop: 0 }}>
          A floating panel with a card's glass and corners: it bends what is behind it at its edges, as a card does,
          with a slightly stronger tint, a button's rim and a deeper shadow. It fades in and out. It is shown in the
          browser's top layer, so it covers everything else on the page wherever it is rendered: no z-index or stacking
          context can hide it. It opens beside an element or at a point, stays inside the window, and calls{' '}
          <code>onClose</code> on Escape or a press outside it.
        </p>
      }
      demos={
        <>
          <Section title="Examples">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignSelf: 'start' }}>
              <PopupButton label="Open popup">
                <p style={{ margin: 0, maxWidth: 240 }}>
                  By default it opens below its anchor, lined up with the anchor's start edge. Escape closes it.
                </p>
              </PopupButton>
            </div>
            <Card>
              <Copy title="Sides">
                <code>side</code> sets which side of the anchor it opens on. Where there isn't room, it flips to the
                opposite side.
              </Copy>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                {sides.map((side) => (
                  <PopupButton key={side} label={side} side={side} align="center">
                    <code>side="{side}"</code>
                  </PopupButton>
                ))}
              </div>
            </Card>
            <Card>
              <Copy title="Above other cards">
                Every card is its own stacking context, but a popup opened inside one still covers the cards around it.
              </Copy>
              <div style={{ marginTop: 16 }}>
                <PopupButton label="Open over the others" side="right" align="center" padding="md">
                  <Copy title="On top">This popup covers every card on the page.</Copy>
                </PopupButton>
              </div>
            </Card>
            <AtPointDemo />
          </Section>
        </>
      }
      props={[
        ['open', 'boolean', '', 'Whether it is shown. It fades in and out as this changes.'],
        ['onClose', '() => void', '', 'Called on Escape, or on a press outside both the popup and its anchor element.'],
        ['anchor', 'RefObject<HTMLElement> | { x, y }', '', 'An element to open beside, or a point to open at.'],
        ['side', "'top' | 'right' | 'bottom' | 'left'", "'bottom'", 'Which side of the anchor it opens on.'],
        ['align', "'start' | 'center' | 'end'", "'start'", 'Which part of that side of the anchor it lines up with.'],
        ['offset', 'number', '8 / 0', 'Gap from the anchor, in px: 8 beside an element, 0 at a point.'],
        ['alignOffset', 'number', '0', 'Shifts it along the anchor, in px, inwards from the edge it lines up with.'],
        ['padding', "'none' | 'sm' | 'md' | 'lg'", "'sm'", '0, 12, 20 or 32px.'],
        ['highlight', 'boolean', 'true', 'Light the rim from the pointer position, as on a card.'],
        ['refract', 'boolean', 'true', 'Glass effect: blurs the backdrop behind it and bends it at the edges.'],
        ['', '', '', 'Every other native <div> prop, ref included.'],
      ]}
      customProperties={[
        ['--prism-popup-glass-opacity', '0.45', 'Opacity of the tint.'],
        ['--prism-popup-blur', '6px', 'Blur of what is behind it.'],
        ['--prism-refraction', '20%', 'How strongly the edges bend what is behind.'],
        ['--prism-popup-shadow', '', 'Its drop shadow.'],
        [
          '--prism-popup-slide',
          '4px',
          'How far it slides away from its anchor as it fades in, and back towards it as it fades out.',
        ],
        ['--prism-popup-in-duration', '200ms', 'How long it takes to fade in.'],
        ['--prism-popup-in-easing', '', 'Easing of the fade in: an ease-out, so it settles into place.'],
        ['--prism-popup-out-duration', '150ms', 'How long it takes to fade out.'],
        ['--prism-popup-out-easing', '', 'Easing of the fade out: an ease-in, so it gathers pace as it goes.'],
        ['--prism-card-bg', '#f3f4f6', 'Colour of the tint, shared with cards.'],
        ['--prism-card-fg', '#111318', 'Text colour, shared with cards.'],
        ['--prism-card-radius', '16px', 'Corner radius, shared with cards.'],
        ['--prism-button-rim-light', '', 'Colour of the lit parts of the rim, shared with buttons.'],
        ['--prism-button-rim-shade', '', "Colour of the rim's shaded part, across the top-right."],
        ['--prism-button-rim-angle', '-40deg', "Rotates the rim's light and shade."],
        ['--prism-button-rim-width', '1px', 'Width of the rim.'],
        ['--prism-card-highlight', '#ffffff', 'Colour of the pointer light on the rim, shared with cards.'],
        ['--prism-card-highlight-size', '', 'Reach of the pointer light, in any length unit.'],
      ]}
    />
  )
}
