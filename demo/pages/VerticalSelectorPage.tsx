import { useState, type ComponentProps } from 'react'
import { Card, VerticalSelector } from '../../src'
import { DemoPage, Section } from '../layout'
import { fruit } from '../samples'

// A vertical selector that keeps its own selection, for the examples.
function StatefulVerticalSelector({
  initial,
  ...props
}: { initial?: string } & Omit<ComponentProps<typeof VerticalSelector>, 'value' | 'onChange'>) {
  const [value, setValue] = useState(initial)
  return <VerticalSelector value={value} onChange={setValue} {...props} />
}

export function VerticalSelectorPage() {
  return (
    <DemoPage
      name="VerticalSelector"
      intro={
        <p style={{ marginTop: 0 }}>
          A vertical list to pick one entry from. The entries themselves are plain text. A glass pill marks the selected
          entry, and a dimmer pill follows the pointer from entry to entry. A mouse press selects straight away, as it
          does on tabs: the glass pill glides across already pressed in, like a pressed button (a little smaller and
          darker, with a shadow all the way round it), and springs back when the mouse button is released. A touch
          selects when the finger lifts. The arrow keys, Home and End move the selection.
        </p>
      }
      demos={
        <>
          <Section title="Examples">
            <Card>
              <h3 style={{ marginTop: 0 }}>Default</h3>
              <StatefulVerticalSelector aria-label="Fruit" items={fruit} initial="cherry" />
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Nothing selected</h3>
              <p>
                Until an entry is picked there is no glass pill: only the dim one shows, while the pointer is over the
                list.
              </p>
              <StatefulVerticalSelector aria-label="Fruit" items={fruit.slice(0, 3)} />
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Disabled entry</h3>
              <StatefulVerticalSelector
                aria-label="Fruit"
                items={fruit.map((f) => (f.value === 'banana' ? { ...f, disabled: true } : f))}
                initial="apple"
              />
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Tinted, slower glide</h3>
              <StatefulVerticalSelector
                aria-label="Fruit"
                items={fruit}
                initial="damson"
                style={{
                  '--prism-vertical-selector-glass': '#6d7cff',
                  '--prism-vertical-selector-glass-opacity': 0.35,
                  '--prism-vertical-selector-glide-duration': '900ms',
                }}
              />
            </Card>
          </Section>
        </>
      }
      props={[
        ['items', '{ value, label, disabled? }[]', '', 'The entries, top to bottom.'],
        ['value', 'string', '', 'The value of the selected entry. If it matches no entry, nothing is selected.'],
        [
          'onChange',
          '(value) => void',
          '',
          'Called with the value of the entry picked by mouse press, tap or keyboard.',
        ],
        ['refract', 'boolean', 'true', 'Blur what is behind the glass pill and bend it at its edges.'],
        ['', '', '', 'Every other native <div> prop, ref included; give it an aria-label.'],
      ]}
      customProperties={[
        ['--prism-vertical-selector-glass', '#ffffff', "Colour of the pill's tint."],
        ['--prism-vertical-selector-glass-opacity', '0.16', 'Opacity of the tint on the pill.'],
        ['--prism-vertical-selector-hover-opacity', '0.5', 'Opacity of the dim pill under the pointer.'],
        ['--prism-vertical-selector-rim', '', "The pill's edge lines and hairline ring."],
        ['--prism-vertical-selector-shadow', '', "The pill's drop shadow at rest."],
        ['--prism-vertical-selector-pressed-shadow', '', "The pill's shadow while pressed, all the way round it."],
        ['--prism-vertical-selector-press-halo', '', 'Colour of the soft halo round the pill while pressed.'],
        ['--prism-vertical-selector-press-tint', '#000000', 'Colour the pill darkens towards while pressed.'],
        ['--prism-vertical-selector-press-tint-opacity', '0.1', 'How far it darkens towards that colour.'],
        ['--prism-vertical-selector-press-shrink', '4px', 'How much narrower the entry and pill get while pressed.'],
        ['--prism-press-duration', '120ms', 'How long the pill takes to press in (shared with buttons).'],
        ['--prism-release-duration', '420ms', 'How long it takes to spring back when released (shared with buttons).'],
        ['--prism-vertical-selector-glide-duration', '400ms', 'How long the pill takes to reach an entry.'],
        ['--prism-vertical-selector-glide-easing', '', 'Easing of that glide: an ease-out, with no overshoot.'],
        [
          '--prism-vertical-selector-hover-glide-duration',
          '300ms',
          'Roughly how long the dim pill takes to catch up with the pointer; it moves on a spring.',
        ],
        ['--prism-vertical-selector-hover-fade-in-duration', '180ms', 'How long the dim pill takes to fade in.'],
        ['--prism-vertical-selector-hover-fade-out-duration', '280ms', 'How long it takes to fade out.'],
        [
          '--prism-vertical-selector-hover-delay',
          '70ms',
          'How long the pointer must rest on the list before the dim pill fades in.',
        ],
        [
          '--prism-vertical-selector-appear-delay',
          '120ms',
          'On page load, the delay between the layout settling and the pill starting to fade in.',
        ],
        ['--prism-vertical-selector-appear-duration', '450ms', 'How long the pill takes to fade in as the page loads.'],
        ['--prism-vertical-selector-gap', '2px', 'Space between entries.'],
        ['--prism-vertical-selector-padding', '10px 16px', 'Padding of each entry.'],
        ['--prism-vertical-selector-idle-opacity', '0.85', 'Opacity of entries neither selected nor hovered.'],
        ['--prism-vertical-selector-focus', '#6d7cff', 'Focus ring colour.'],
        ['--prism-refraction', '30%', 'How strongly the glass pill bends what is behind it.'],
        ['--prism-card-radius', '16px', 'Corner radius, shared with cards and buttons.'],
      ]}
    />
  )
}
