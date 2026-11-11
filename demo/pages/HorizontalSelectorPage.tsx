import { useState, type ComponentProps } from 'react'
import { Card, HorizontalSelector } from '../../src'
import { DemoPage, Section } from '../layout'
import { fruit } from '../samples'

const ranges = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

// A horizontal selector that keeps its own selection, for the examples.
function StatefulHorizontalSelector({
  initial,
  ...props
}: { initial?: string } & Omit<ComponentProps<typeof HorizontalSelector>, 'value' | 'onChange'>) {
  const [value, setValue] = useState(initial)
  return <HorizontalSelector value={value} onChange={setValue} {...props} />
}

export function HorizontalSelectorPage() {
  return (
    <DemoPage
      name="HorizontalSelector"
      intro={
        <p style={{ marginTop: 0 }}>
          A row of entries to pick one from, inside a single glass track. A bright glass pill marks the selected entry,
          and a dimmer pill follows the pointer from entry to entry. A mouse press selects straight away, as it does on
          tabs: the bright pill slides across already pressed in, like a pressed button, and springs back when the mouse
          button is released. A touch selects when the finger lifts. The left and right arrow keys, Home and End move
          the selection.
        </p>
      }
      demos={
        <>
          {/* Wide enough for a card to hold a row of four */}
          <Section title="Examples" column={360}>
            {/* Directly on the backdrop, where the track's own glass shows best */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'start' }}>
              <StatefulHorizontalSelector aria-label="Range" items={ranges} initial="week" />
              <StatefulHorizontalSelector aria-label="Fruit" items={fruit} initial="cherry" />
            </div>
            <Card>
              <h3 style={{ marginTop: 0 }}>Nothing selected</h3>
              <p>
                Until an entry is picked there is no bright pill: only the dim one shows, while the pointer is over the
                row.
              </p>
              <StatefulHorizontalSelector aria-label="Range" items={ranges.slice(0, 3)} />
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Full width, disabled entry</h3>
              <p>Given a width, the entries share the extra space between them.</p>
              <StatefulHorizontalSelector
                aria-label="Range"
                items={ranges.map((r) => (r.value === 'month' ? { ...r, disabled: true } : r))}
                initial="day"
                style={{ width: '100%' }}
              />
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Tinted, slower slide</h3>
              <StatefulHorizontalSelector
                aria-label="Range"
                items={ranges}
                initial="year"
                style={{
                  '--prism-horizontal-selector-glass': '#6d7cff',
                  '--prism-horizontal-selector-glass-opacity': 0.45,
                  '--prism-horizontal-selector-glide-duration': '900ms',
                }}
              />
            </Card>
          </Section>
        </>
      }
      props={[
        ['items', '{ value, label, disabled? }[]', '', 'The entries, left to right.'],
        ['value', 'string', '', 'The value of the selected entry. If it matches no entry, nothing is selected.'],
        [
          'onChange',
          '(value) => void',
          '',
          'Called with the value of the entry picked by mouse press, tap or keyboard.',
        ],
        ['refract', 'boolean', 'true', 'Blur what is behind the track and glass pill and bend it at their edges.'],
        ['', '', '', 'Every other native <div> prop, ref included; give it an aria-label.'],
      ]}
      customProperties={[
        ['--prism-horizontal-selector-track-bg', '#f3f4f6', "Colour of the track's tint (#24272e in dark mode)."],
        ['--prism-horizontal-selector-track-opacity', '0.3', 'Opacity of the tint on the track.'],
        [
          '--prism-horizontal-selector-track-rim-light',
          '',
          "Colour of the lit part of the track's rim, round the top-right.",
        ],
        ['--prism-horizontal-selector-track-rim-shade', '', 'Colour of its shaded part, across the top-left.'],
        ['--prism-horizontal-selector-track-rim-bounce', '', 'Colour of its dimmer lit part, round the bottom-left.'],
        [
          '--prism-horizontal-selector-track-rim-shade-bottom',
          '',
          'Colour of its lighter shaded part, across the bottom-right.',
        ],
        ['--prism-horizontal-selector-track-rim-width', '1px', "Width of the track's rim."],
        ['--prism-horizontal-selector-track-highlight', '', 'The crescent of light inside the top and right.'],
        ['--prism-horizontal-selector-track-bounce', '', 'The dimmer crescent inside the bottom and left.'],
        ['--prism-horizontal-selector-track-glint', '', 'The glints inside the top-right and bottom-left.'],
        ['--prism-horizontal-selector-track-shadow', '', "The track's drop shadow."],
        ['--prism-horizontal-selector-track-sheen', '', "The light inside the track's top edge."],
        ['--prism-horizontal-selector-fg', '#111318', 'Text colour (#eceef2 in dark mode).'],
        ['--prism-horizontal-selector-inset', '4px', "Space between the track's edge and the pill."],
        ['--prism-horizontal-selector-glass', '#ffffff', "Colour of the pill's tint."],
        ['--prism-horizontal-selector-glass-opacity', '0.45', 'Opacity of the tint on the pill (0.16 in dark mode).'],
        ['--prism-horizontal-selector-hover-opacity', '0.45', 'Opacity of the dim pill under the pointer.'],
        ['--prism-horizontal-selector-rim', '', "The pill's edge lines and hairline ring."],
        ['--prism-horizontal-selector-shadow', '', "The pill's drop shadow at rest."],
        ['--prism-horizontal-selector-pressed-shadow', '', "The pill's shadow while pressed, all the way round it."],
        ['--prism-horizontal-selector-press-halo', '', 'Colour of the soft halo round the pill while pressed.'],
        ['--prism-horizontal-selector-press-tint', '#000000', 'Colour the pill darkens towards while pressed.'],
        ['--prism-horizontal-selector-press-tint-opacity', '0.08', 'How far it darkens towards that colour.'],
        ['--prism-horizontal-selector-press-shrink', '4px', 'How much narrower the entry and pill get while pressed.'],
        ['--prism-horizontal-selector-glide-duration', '400ms', 'How long the pill takes to reach an entry.'],
        ['--prism-horizontal-selector-glide-easing', '', 'Easing of that slide: an ease-out, with no overshoot.'],
        [
          '--prism-horizontal-selector-hover-glide-duration',
          '300ms',
          'Roughly how long the dim pill takes to catch up with the pointer; it moves on a spring.',
        ],
        ['--prism-horizontal-selector-hover-fade-in-duration', '180ms', 'How long the dim pill takes to fade in.'],
        ['--prism-horizontal-selector-hover-fade-out-duration', '280ms', 'How long it takes to fade out.'],
        [
          '--prism-horizontal-selector-hover-delay',
          '70ms',
          'How long the pointer must rest on the row before the dim pill fades in.',
        ],
        [
          '--prism-horizontal-selector-appear-delay',
          '120ms',
          'On page load, the delay between the layout settling and the pill starting to fade in.',
        ],
        [
          '--prism-horizontal-selector-appear-duration',
          '450ms',
          'How long the pill takes to fade in as the page loads.',
        ],
        ['--prism-horizontal-selector-gap', '4px', 'Space between entries.'],
        ['--prism-horizontal-selector-padding', '8px 18px', 'Padding of each entry.'],
        ['--prism-horizontal-selector-idle-opacity', '0.8', 'Opacity of entries neither selected nor hovered.'],
        ['--prism-horizontal-selector-focus', '#6d7cff', 'Focus ring colour.'],
        ['--prism-refraction', '20% / 30%', 'How strongly the track / glass pill bend what is behind them.'],
      ]}
    />
  )
}
