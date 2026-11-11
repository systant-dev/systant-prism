import { useState, type CSSProperties } from 'react'
import { Button, CardGrid, Textarea, Toggle, type CardGridItem, type CardGridLayout } from '../../src'
import { DemoPage, Section } from '../layout'

const stat: CSSProperties = { fontSize: 32, fontWeight: 300, margin: '4px 0' }
const muted: CSSProperties = { margin: 0, opacity: 0.7 }

function Stat({ value, note }: { value: string; note: string }) {
  return (
    <>
      <p style={stat}>{value}</p>
      <p style={muted}>{note}</p>
    </>
  )
}

function Alerts() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {['Email', 'Push', 'Weekly digest'].map((label, i) => (
        <label key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {label}
          <Toggle defaultChecked={i !== 2} />
        </label>
      ))}
    </div>
  )
}

const items: CardGridItem[] = [
  { id: 'revenue', title: 'Revenue', content: <Stat value="£48,210" note="Up 12% on last month" /> },
  { id: 'visitors', title: 'Visitors', content: <Stat value="9,832" note="1,204 today" /> },
  { id: 'orders', title: 'Orders', content: <Stat value="611" note="38 waiting to ship" /> },
  { id: 'alerts', title: 'Alerts', content: <Alerts /> },
  {
    id: 'notes',
    title: 'Notes',
    content: (
      // As tall as the card where the card has a height of its own (maximised, or in fixed rows)
      <Textarea
        aria-label="Notes"
        rows={2}
        defaultValue="Minimised cards stay mounted, so what you type here is still here when the card comes back."
        style={{ width: '100%', '--prism-textarea-height': '100%' }}
      />
    ),
  },
  { id: 'uptime', title: 'Uptime', content: <Stat value="99.98%" note="Last incident 41 days ago" /> },
]

const startingLayout: CardGridLayout = { order: ['visitors', 'revenue'], minimised: ['uptime'], maximised: null }

function ControlledDemo() {
  const [layout, setLayout] = useState(startingLayout)
  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 16 }}>
      <CardGrid
        items={items.slice(0, 4).concat(items[5])}
        layout={layout}
        onLayoutChange={setLayout}
        padding="sm"
        style={{ '--prism-card-grid-column': '200px' }}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => setLayout(startingLayout)}>
          Reset layout
        </Button>
        <code style={{ color: '#fff', textShadow: '0 1px 4px rgb(0 0 0 / 0.6)' }}>{JSON.stringify(layout)}</code>
      </div>
    </div>
  )
}

export function CardGridPage() {
  return (
    <DemoPage
      name="CardGrid"
      intro={
        <p style={{ marginTop: 0 }}>
          A grid of glass cards that can be rearranged. Drag a card by its header to move it: the other cards slide out
          of its way, and any card under it darkens and blurs, as if seen through the glass. Drop it and it springs into
          place, with a ripple through the cards around it; press Escape while dragging to put everything back. With a
          card's title focused, the left and right arrow keys move the card one place, and the up and down arrow keys
          move it a row. Minimise sends a card to the tray above the grid, where clicking its chip brings it back.
          Maximise, or a double-click on the header, makes a card fill the grid.
        </p>
      }
      demos={
        <>
          <Section title="Dashboard">
            {/* Given a min-height, so a maximised card has room to fill */}
            <CardGrid items={items} style={{ gridColumn: '1 / -1', minHeight: 520 }} />
          </Section>

          <Section title="Fixed rows and columns">
            {/* Three columns by two rows, which share the grid's fixed height equally */}
            <CardGrid items={items} columns={3} rows={2} padding="sm" style={{ gridColumn: '1 / -1', height: 420 }} />
          </Section>

          <Section title="Controlled">
            <ControlledDemo />
          </Section>
        </>
      }
      props={[
        [
          'items',
          '{ id, title, label?, content }[]',
          '',
          "The cards. Give a card a label, its accessible name, when its title isn't plain text.",
        ],
        [
          'layout',
          '{ order, minimised, maximised }',
          '',
          'The arrangement: the order of the cards, which are minimised and which is maximised. Set it, with onLayoutChange, to keep the arrangement in your own state.',
        ],
        ['defaultLayout', 'Partial<CardGridLayout>', '', 'The arrangement at first, when layout is left out.'],
        [
          'onLayoutChange',
          '(layout) => void',
          '',
          'Called with the new arrangement when a card is moved, minimised, restored or maximised.',
        ],
        ['padding', "'none' | 'sm' | 'md' | 'lg'", "'md'", "Padding of each card's body."],
        ['columns', 'number', '', 'The number of columns, all the same width. Left out, there are as many as fit.'],
        [
          'rows',
          'number',
          '',
          "The number of rows, which share the grid's height equally. More rows are added if the cards need them.",
        ],
        ['trayLabel', 'string', "'Minimised cards'", 'Accessible name of the tray.'],
        [
          'trayPlaceholder',
          'ReactNode',
          "'Minimised cards appear here'",
          "Shown faintly in the tray while it is empty; '' shows nothing.",
        ],
        ['', '', '', 'Every other native <div> prop, ref included.'],
      ]}
      customProperties={[
        ['--prism-card-grid-column', '280px', 'Minimum width of a column.'],
        ['--prism-card-grid-gap', '16px', 'Space between cards.'],
        [
          '--prism-card-grid-tray-gap',
          '',
          'Space between the tray and the grid; half the gap between cards by default.',
        ],
        [
          '--prism-card-grid-duration',
          '350ms',
          'How long cards take to slide to a new place, and to fade (0s with reduced motion).',
        ],
        ['--prism-card-grid-easing', '', 'Easing of that slide.'],
        ['--prism-card-grid-lifted-shadow', '', 'Shadow of a card while dragged.'],
        [
          '--prism-card-grid-spring',
          '6px',
          'How far a dropped card overshoots as it springs into place; the cards around it move less the further away they are. 0px turns it off.',
        ],
        ['--prism-card-grid-spring-duration', '900ms', 'How long the spring takes to settle.'],
        [
          '--prism-card-grid-minimise-duration',
          '200ms',
          'How long a minimised card takes to fade out while its chip fades in (0s with reduced motion).',
        ],
        ['--prism-card-grid-tray-placeholder-opacity', '0.45', "Opacity of the tray's placeholder."],
        [
          '--prism-card-grid-maximise-fade',
          '150ms',
          'How long the other cards take to fade out before a card is maximised (0s with reduced motion).',
        ],
        [
          '--prism-card-grid-maximise-duration',
          '250ms',
          'How long the card then takes to grow to fill the grid (0s with reduced motion).',
        ],
        ['--prism-card-grid-under-blur', '6px', 'The blur of a card that is completely under a dragged one.'],
        [
          '--prism-card-grid-under-shade',
          'rgb(0 0 0 / 0.2)',
          'The tint over a card that is completely under a dragged one.',
        ],
      ]}
    />
  )
}
