import type { CSSProperties } from 'react'
import { Button, Card } from '../../src'
import { Copy, DemoPage, Section } from '../layout'

const bigButton: CSSProperties = { flexDirection: 'column', padding: '28px 40px', fontSize: 18 }

function TrendIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </svg>
  )
}

export function ButtonPage() {
  return (
    <DemoPage
      name="Button"
      intro={
        <p style={{ marginTop: 0 }}>
          A button of smoky glass, with the same corners as a card. It blurs what is behind it, without bending it as a
          card does, and a soft glare follows the pointer while it is over the button. Its <code>type</code> defaults to{' '}
          <code>"button"</code>, so it only submits a form if you set <code>type="submit"</code>.
        </p>
      }
      demos={
        <>
          <Section title="Examples">
            {/* Directly on the backdrop, where the glass shows best */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignSelf: 'start' }}>
              <Button style={bigButton}>
                <TrendIcon />
                Analytics
              </Button>
              <Button style={{ ...bigButton, '--prism-button-bg': '#12a594' }}>
                <TrendIcon />
                Tinted
              </Button>
              <Button variant="secondary" style={bigButton}>
                <TrendIcon />
                Secondary
              </Button>
            </div>
            <Card>
              <Copy title="Same corners">
                Buttons take their corner radius from <code>--prism-card-radius</code>, as cards do.
              </Copy>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <Button>Default</Button>
                <Button aria-pressed>Pressed</Button>
                <Button disabled>Disabled</Button>
              </div>
            </Card>
            <Card>
              <Copy title="Secondary">
                <code>variant="secondary"</code> is clearer, flatter glass, for a lesser action beside the main one.
              </Copy>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <Button variant="secondary">Default</Button>
                <Button variant="secondary" aria-pressed>
                  Pressed
                </Button>
                <Button variant="secondary" disabled>
                  Disabled
                </Button>
              </div>
            </Card>
            <Card padding="lg" style={{ '--prism-card-radius': '6px' }}>
              <Copy title="Custom radius">A radius set on a card reaches the buttons inside it.</Copy>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <Button variant="secondary">Cancel</Button>
                <Button>Confirm</Button>
              </div>
            </Card>
          </Section>
        </>
      }
      props={[
        ['variant', "'primary' | 'secondary'", "'primary'", 'Secondary is clearer, flatter glass.'],
        ['blur', 'boolean', 'true', 'Blurs what is behind the button.'],
        ['glare', 'boolean', 'true', 'Shows a glare that follows the pointer over the button.'],
        ['type', 'string', "'button'", 'As on a native button.'],
        ['', '', '', 'Every other native <button> prop, ref included.'],
      ]}
      customProperties={[
        ['--prism-button-bg', '#111318', 'Colour of the glass tint.'],
        ['--prism-button-fg', '#ffffff', 'Text colour.'],
        ['--prism-button-glass-opacity', '0.3', 'Opacity of the tint.'],
        ['--prism-button-secondary-glass-opacity', '0.12', 'The same, for the secondary variant.'],
        ['--prism-button-blur', '10px', 'Blur of what is behind the button.'],
        ['--prism-button-focus', '#6d7cff', 'Focus ring colour.'],
        ['--prism-button-disabled-opacity', '0.45', 'Opacity of the label and rim while disabled.'],
        ['--prism-button-press-scale', '0.95', 'Scale while pressed.'],
        ['--prism-button-press-duration', '120ms', 'How long the button takes to press in.'],
        ['--prism-button-release-duration', '420ms', 'How long it takes to spring back when released.'],
        ['--prism-glare-intensity', '0.3', 'Strength of the pointer glare.'],
        ['--prism-card-radius', '16px', 'Corner radius, shared with cards.'],
      ]}
    />
  )
}
