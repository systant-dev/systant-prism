import { useState, type CSSProperties, type ReactNode } from 'react'
import { Card, Fade, HorizontalSelector, ScrollArea } from '../src'

const heading: CSSProperties = { color: '#fff', textShadow: '0 1px 4px rgb(0 0 0 / 0.6)' }

// `column` is the narrowest a column may get.
export function Section({ title, column = 240, children }: { title: string; column?: number; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ ...heading, fontSize: 18 }}>{title}</h2>
      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: `repeat(auto-fill, minmax(${column}px, 1fr))` }}>
        {children}
      </div>
    </section>
  )
}

export function Copy({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ marginBottom: 0 }}>{children}</p>
    </>
  )
}

// A component's name, what it is and how to import it, above its examples.
function Intro({ name, children }: { name: string; children: ReactNode }) {
  return (
    <header style={{ marginBottom: 40 }}>
      <h1 style={{ ...heading, marginTop: 8 }}>{name}</h1>
      <Card style={{ maxWidth: 720 }}>
        {children}
        {/* Scrolls sideways in our own scroll area if the card is narrower than the line */}
        <ScrollArea axis="x">
          <pre style={{ margin: 0 }}>
            <code>import {`{ ${name} }`} from '@systant/prism'</code>
          </pre>
        </ScrollArea>
      </Card>
    </header>
  )
}

// A page of text: a title above one card, which scrolls with the page if it is
// taller than the window.
export function TextPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollArea axis="both">
      <main style={{ padding: '0 16px' }}>
        <h1 style={{ ...heading, marginTop: 8 }}>{title}</h1>
        <Card style={{ maxWidth: 720 }}>{children}</Card>
      </main>
    </ScrollArea>
  )
}

const cell: CSSProperties = {
  padding: '8px 12px 8px 0',
  borderBottom: '1px solid var(--prism-card-border)',
  textAlign: 'left',
  verticalAlign: 'top',
}

// A reference table: one row per prop or custom property, every column but the
// last (the description) as code.
function Reference({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <section>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>{title}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} style={cell}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* By position: a row that carries on from the one above has no name of its own */}
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((value, i) => (
                <td key={i} style={i === 0 ? { ...cell, whiteSpace: 'nowrap' } : cell}>
                  {i < row.length - 1 && value ? <code>{value}</code> : value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const tabs = [
  { value: 'demos', label: 'Demos' },
  { value: 'properties', label: 'Properties' },
] as const

type Tab = (typeof tabs)[number]['value']

// The layout every component page shares. A selector centred at the top switches
// between two tabs: the component's name, intro and demos, which scroll as a
// page, and a card listing its props and custom properties, which stays on
// screen and scrolls its own content.
export function DemoPage({
  name,
  intro,
  demos,
  props,
  customProperties,
}: {
  name: string
  intro: ReactNode
  demos: ReactNode
  props: string[][]
  customProperties: string[][]
}) {
  const [tab, setTab] = useState<Tab>('demos')
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HorizontalSelector
        aria-label="View"
        items={tabs}
        value={tab}
        onChange={setTab}
        style={{ alignSelf: 'center' }}
      />

      {/* Crossfades between the two tabs. Each tab has its own scroller, so it starts at the top */}
      <Fade contentKey={tab} style={{ flex: 1, minHeight: 0 }}>
        {tab === 'demos' ? (
          <ScrollArea axis="both">
            <main style={{ padding: '0 16px' }}>
              <Intro name={name}>{intro}</Intro>
              {demos}
            </main>
          </ScrollArea>
        ) : (
          // The card is never taller than the space under the tabs: a long reference scrolls inside it
          <main style={{ display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0 16px' }}>
            <Card padding="none" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <ScrollArea axis="both">
                {/* As wide as the card, or as the tables at their narrowest if that is wider, so the padding scrolls with them */}
                <div
                  style={{
                    display: 'grid',
                    gap: 32,
                    padding: 20,
                    width: 'fit-content',
                    minWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <Reference title="Props" columns={['Prop', 'Type', 'Default', 'Description']} rows={props} />
                  <Reference
                    title="Custom properties"
                    columns={['Property', 'Default', 'Description']}
                    rows={customProperties}
                  />
                </div>
              </ScrollArea>
            </Card>
          </main>
        )}
      </Fade>
    </div>
  )
}
