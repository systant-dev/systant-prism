import type { CSSProperties } from 'react'
import { Card, Toggle } from '../../src'
import { DemoPage, Section } from '../layout'

const settings = [
  { label: 'Wi-Fi', on: true },
  { label: 'Bluetooth', on: false },
  { label: 'Location', on: true },
]

const settingRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '10px 0',
}

export function TogglePage() {
  return (
    <DemoPage
      name="Toggle"
      intro={
        <p style={{ marginTop: 0 }}>
          An on/off switch: a glass track that looks sunk into the surface, edged with a button's rim, and a round knob
          of clear glass. Switching it on slides the knob to the far end and fills the track with a tint. While it is
          pressed, the whole toggle shrinks a little, the knob presses in like a pressed button, and the light on the
          rim turns, as it does on a button. A click, a tap, Enter or the space bar switches it. Give it an{' '}
          <code>aria-label</code>, or put it in a <code>&lt;label&gt;</code> with its text; clicking the label switches
          it too.
        </p>
      }
      demos={
        <>
          <Section title="Examples">
            {/* Directly on the backdrop, where its glass shows best */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', alignSelf: 'start' }}>
              <Toggle aria-label="Off" />
              <Toggle aria-label="On" defaultChecked />
              <Toggle
                aria-label="Large"
                defaultChecked
                style={{
                  '--prism-toggle-width': '76px',
                  '--prism-toggle-height': '44px',
                  '--prism-toggle-inset': '4px',
                }}
              />
            </div>
            <Card>
              <h3 style={{ marginTop: 0 }}>Settings</h3>
              {settings.map(({ label, on }) => (
                <label key={label} style={settingRow}>
                  {label}
                  <Toggle defaultChecked={on} />
                </label>
              ))}
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Disabled</h3>
              <label style={settingRow}>
                Off
                <Toggle disabled />
              </label>
              <label style={settingRow}>
                On
                <Toggle disabled defaultChecked />
              </label>
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Tinted, slower slide</h3>
              <label style={settingRow}>
                Dark mode
                <Toggle
                  defaultChecked
                  style={{
                    '--prism-toggle-on-bg': '#12a594',
                    '--prism-toggle-slide-duration': '700ms',
                  }}
                />
              </label>
            </Card>
          </Section>
        </>
      }
      props={[
        ['checked', 'boolean', '', 'Whether it is on. Leave it out and the toggle keeps track of its own state.'],
        ['defaultChecked', 'boolean', 'false', 'Whether it starts on, when checked is left out.'],
        ['onChange', '(checked) => void', '', 'Called with the new state when it is switched.'],
        ['refract', 'boolean', 'true', 'Blur what is behind the track and knob and bend it at their edges.'],
        ['type', 'string', "'button'", 'As on a native button.'],
        ['', '', '', 'Every other native <button> prop, ref included; give it an aria-label or a <label>.'],
      ]}
      customProperties={[
        ['--prism-toggle-width', '52px', "The track's width."],
        [
          '--prism-toggle-height',
          '32px',
          "The track's height. The knob is as wide as this, less the inset on each side.",
        ],
        ['--prism-toggle-inset', '3px', "Space between the track's edge and the knob."],
        ['--prism-toggle-track-bg', '#f3f4f6', "Colour of the track's tint (#24272e in dark mode)."],
        ['--prism-toggle-track-opacity', '0.3', 'Opacity of the tint on the track.'],
        ['--prism-toggle-track-shadow', '', "The shadow inside the track's top edge, which makes it look recessed."],
        [
          '--prism-toggle-rim-light',
          '',
          'Colour of the rim along its top edge. Textbox uses it for its focused rim too.',
        ],
        ['--prism-toggle-rim-side', '', 'Colour of the rim halfway down each end.'],
        ['--prism-toggle-rim-bottom', '', 'Colour of the rim along its bottom edge.'],
        ['--prism-toggle-on-bg', '#6d7cff', 'Colour that fills the track when on.'],
        ['--prism-toggle-on-opacity', '0.75', 'Opacity of that colour over the track.'],
        ['--prism-toggle-knob-bg', '#ffffff', "Colour of the knob's tint."],
        ['--prism-toggle-knob-opacity', '0.25', 'Opacity of the tint on the knob (0.18 in dark mode).'],
        [
          '--prism-toggle-knob-hover-opacity',
          '0.35',
          'Opacity of the tint on the knob while the pointer is over the toggle.',
        ],
        ['--prism-toggle-knob-sheen', '', "A diagonal sheen over the knob's tint."],
        [
          '--prism-toggle-knob-rim',
          '',
          "The curved highlights inside the knob's edge, and the hairline ring round it.",
        ],
        ['--prism-toggle-knob-shadow', '', "The knob's drop shadow at rest."],
        ['--prism-toggle-knob-pressed-shadow', '', "The knob's shadow while pressed, all the way round it."],
        ['--prism-toggle-press-halo', '', 'Colour of the soft halo round the knob while pressed.'],
        ['--prism-toggle-press-scale', '0.97', 'Scale of the whole toggle while pressed.'],
        ['--prism-toggle-knob-press-scale', '0.9', 'Scale of the knob while pressed, on top of that.'],
        [
          '--prism-toggle-knob-stretch',
          '6px',
          'How much wider the knob gets while pressed, stretching towards the other end of the track.',
        ],
        ['--prism-toggle-slide-duration', '300ms', 'How long the knob takes to slide across.'],
        ['--prism-toggle-slide-easing', '', 'Easing of that slide: an ease-out, with no overshoot.'],
        ['--prism-toggle-focus', '#6d7cff', 'Focus ring colour.'],
        ['--prism-toggle-disabled-opacity', '0.45', 'Opacity of the fill and rim while disabled.'],
        ['--prism-refraction', '20% / 30%', 'How strongly the track / knob bend what is behind them.'],
        ['--prism-button-rim-width', '1px', 'Width of the rim.'],
        ['--prism-button-press-rim-turn', '45deg', "How far the rim's light turns while pressed."],
      ]}
    />
  )
}
