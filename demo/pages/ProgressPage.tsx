import { useEffect, useState } from 'react'
import { Button, Card, Progress, ProgressOverlay } from '../../src'
import { DemoPage, Section } from '../layout'

const centred = { display: 'flex', justifyContent: 'center', padding: 16 }

/** How long the overlay demo shows for, in ms. */
const OVERLAY_TIME = 3000

// Shows the overlay for a few seconds, as it would show for a real wait.
function OverlayDemo() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => setOpen(false), OVERLAY_TIME)
    return () => clearTimeout(timer)
  }, [open])

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Over the page</h3>
      <p>The whole page dims under the ring, and can't be clicked or typed in until the overlay closes.</p>
      <Button onClick={() => setOpen(true)}>Show for 3 seconds</Button>
      <ProgressOverlay open={open} aria-label="Loading the demo" />
    </Card>
  )
}

export function ProgressPage() {
  return (
    <DemoPage
      name="Progress"
      intro={
        <p style={{ marginTop: 0 }}>
          A loading indicator: a ring of glass with a soft arc of colour, its fill, travelling round inside it. The
          glass bends what is behind it at the bottom of the ring and only blurs it at the top. The fill covers an
          eighth of the ring and fades out at its ends and edges. The animation runs on the compositor, so a busy page
          can't make it stutter. The colours of the fill and the glass follow the page's glass, light or dark. With{' '}
          <code>prefers-reduced-motion</code> the fill stays where it is and pulses instead.{' '}
          <code>ProgressOverlay</code> shows the ring over the whole page, with everything under it dimmed.
        </p>
      }
      demos={
        <Section title="Examples" column={280}>
          {/* Directly on the backdrop, where its glass shows best */}
          <div style={centred}>
            <Progress />
          </div>
          <OverlayDemo />
          <Card>
            <h3 style={{ marginTop: 0 }}>On a card</h3>
            <div style={centred}>
              <Progress aria-label="Loading the report" />
            </div>
          </Card>
          <div style={centred}>
            <Progress
              style={{
                '--prism-progress-size': '200px',
                '--prism-progress-thickness': '36px',
                '--prism-progress-fill-soft': '12px',
              }}
            />
          </div>
          <div style={centred}>
            <Progress
              readableFill={false}
              style={{ '--prism-progress-fill': '#6d7cff', '--prism-progress-fill-opacity': '1' }}
            />
          </div>
        </Section>
      }
      props={[
        ['refract', 'boolean', 'true', 'Bend what is behind the ring, as thick glass does.'],
        [
          'readableFill',
          'boolean',
          'true',
          "Automatic fill colour: the page's text colour inside a GlassBackdrop, and on an opaque background a colour adjusted, if need be, to stay visible. Turn it off to set --prism-progress-fill yourself.",
        ],
        ['aria-label', 'string', "'Loading'", 'Its accessible name; aria-labelledby overrides it.'],
        ['', '', '', 'Every other native <div> prop except children, ref included.'],
      ]}
      customProperties={[
        ['--prism-progress-size', '120px', "The ring's outer diameter."],
        ['--prism-progress-thickness', '24px', 'Thickness of the ring.'],
        ['--prism-progress-edge-soft', '1.5px', "How soft the ring's edges are; 0px makes them sharp."],
        ['--prism-progress-duration', '1800ms', 'How long the fill takes to go round once.'],
        ['--prism-progress-appear', '150ms', 'How long the fill takes to fade in.'],
        [
          '--prism-progress-arc',
          '45deg',
          'The angle the fill covers, measured between the points where it is at half strength.',
        ],
        [
          '--prism-progress-arc-fade',
          '34deg',
          'The angle over which each end of the fill fades out, centred on its half-strength point.',
        ],
        ['--prism-progress-fill', '#111318', 'Colour of the fill (#eceef2 in dark mode).'],
        ['--prism-progress-fill-opacity', '0.8', 'Opacity of the fill at its strongest.'],
        ['--prism-progress-fill-soft', '8px', 'How far the fill fades in from the inner and outer edges of the ring.'],
        ['--prism-progress-bg', '#f3f4f6', "The glass's tint (#24272e in dark mode)."],
        ['--prism-progress-glass-opacity', '0.16', 'Opacity of the tint.'],
        ['--prism-progress-light', '1', 'Strength of the highlights on the glass (0.6 on dark glass).'],
        ['--prism-progress-shadow', '', 'The shadow round the ring.'],
        ['--prism-progress-hole-shadow', '', 'The shadow the ring casts into its hole.'],
        ['--prism-refraction', '26%', 'How strongly it bends what is behind it, at its bottom.'],
        ['--prism-refraction-blur', '1px', 'How far it blurs what is behind it, at its bottom.'],
        ['--prism-refraction-frost', '6px', 'How far it blurs what is behind it at its top, where it no longer bends.'],
        ['--prism-progress-dim', 'rgb(0 0 0 / 0.25)', 'ProgressOverlay: the colour that dims the page.'],
        ['--prism-progress-dim-duration', '250ms', 'ProgressOverlay: how long the dimming takes to fade in or out.'],
        ['--prism-progress-dim-easing', 'ease-in-out', 'ProgressOverlay: the easing of that fade.'],
        ['--prism-progress-overlay-in-duration', '150ms', 'ProgressOverlay: how long the ring takes to fade in.'],
        ['--prism-progress-overlay-out-duration', '120ms', 'ProgressOverlay: how long the ring takes to fade out.'],
      ]}
    />
  )
}
