import { useState, type CSSProperties } from 'react'
import { Card, Textbox } from '../../src'
import { DemoPage, Section } from '../layout'

const field: CSSProperties = { display: 'grid', gap: 6, marginTop: 12 }

const full: CSSProperties = { width: '100%' }

// The text is kept in this component's state rather than the textbox's, and shown under it.
function Search() {
  const [query, setQuery] = useState('Lanterns')
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Controlled</h3>
      <p>
        With <code>value</code> and <code>onChange</code>, your own state holds the text. The line below reads it.
      </p>
      <Textbox
        aria-label="Search"
        type="search"
        placeholder="Search…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        style={full}
      />
      <p style={{ marginBottom: 0 }}>{query ? `Searching for “${query}”` : 'Nothing to search for'}</p>
    </>
  )
}

export function TextboxPage() {
  return (
    <DemoPage
      name="Textbox"
      intro={
        <p style={{ marginTop: 0 }}>
          A single-line text input shaped like a pill, with a clear button at its end, behind a short separator. At rest
          it is flat: a plain tint and a border. When it is focused, all its text is selected, the tint gets a little
          stronger and the border fades into a lit rim with a shadow inside its top edge, the same edge a Toggle has, so
          the field looks sunk into the surface. The clear button calls <code>onChange</code>, as any other edit does.
          Give it an <code>aria-label</code>, or put it in a <code>&lt;label&gt;</code> with its text.
        </p>
      }
      demos={
        <>
          <Section title="Examples">
            {/* Directly on the backdrop, with no card behind them */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', alignSelf: 'start' }}>
              <Textbox aria-label="Name" placeholder="Your name" />
              <Textbox aria-label="City" defaultValue="Lisbon" />
            </div>
            <Card>
              <h3 style={{ marginTop: 0 }}>On a card</h3>
              <label style={field}>
                Name
                <Textbox placeholder="Your name" style={full} />
              </label>
              <label style={field}>
                Email
                <Textbox type="email" defaultValue="ada@example.com" style={full} />
              </label>
            </Card>
            <Card>
              <Search />
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Disabled and read-only</h3>
              <label style={field}>
                Disabled
                <Textbox disabled defaultValue="Can't touch this" style={full} />
              </label>
              <label style={field}>
                Read-only
                <Textbox readOnly defaultValue="Read me" style={full} />
              </label>
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Larger, with a slower focus effect</h3>
              <Textbox
                aria-label="Larger"
                defaultValue="Take your time"
                style={{
                  ...full,
                  '--prism-textbox-height': '48px',
                  '--prism-textbox-padding': '20px',
                  '--prism-textbox-focus-duration': '800ms',
                  '--prism-textbox-blur-duration': '1200ms',
                }}
              />
            </Card>
          </Section>
        </>
      }
      props={[
        [
          'type',
          'TextboxType',
          "'text'",
          "'text', 'search', 'email', 'url', 'tel' or 'password'. For a number, use inputMode=\"numeric\".",
        ],
        ['clearLabel', 'string', "'Clear'", 'Accessible name of the clear button.'],
        [
          'readableText',
          'boolean',
          'true',
          "Automatic text colour: the page's text colour inside a GlassBackdrop, and on an opaque background a colour adjusted, if need be, to stay readable.",
        ],
        [
          'readableSelection',
          'boolean',
          'true',
          "Automatic colours for selected text: the page's selection colours inside a GlassBackdrop, and elsewhere a highlight adjusted to stand out and keep its text readable.",
        ],
        [
          'className, style',
          '',
          '',
          'Applied to the outermost element, so a width or a custom property affects the whole field.',
        ],
        ['', '', '', 'Every other native <input> prop, ref included, is passed to the input. Give it a label.'],
      ]}
      customProperties={[
        ['--prism-textbox-width', '240px', "The field's width. To change one field only, set width in its style."],
        ['--prism-textbox-height', '40px', "The field's height."],
        ['--prism-textbox-padding', '16px', 'Space between the start of the field and its text.'],
        ['--prism-textbox-bg', '#f3f4f6', "Colour of the field's tint (#24272e in dark mode)."],
        ['--prism-textbox-opacity', '0.6', 'Opacity of the tint.'],
        ['--prism-textbox-focus-opacity', '0.65', 'Opacity of the tint while focused.'],
        ['--prism-textbox-fg', '#111318', 'Colour of the text and the clear icon (#eceef2 in dark mode).'],
        ['--prism-textbox-border', '', 'Colour of the border at rest.'],
        ['--prism-textbox-placeholder-opacity', '0.6', 'Opacity of the placeholder text.'],
        [
          '--prism-textbox-selection',
          '#6d7cff',
          'Colour of the selection highlight outside a GlassBackdrop (#9aa5ff in dark mode).',
        ],
        [
          '--prism-textbox-selection-fg',
          '#111318',
          'Colour of selected text outside a GlassBackdrop. Black or white is used instead where that lets the highlight stay closer to its own colour.',
        ],
        [
          '--prism-textbox-focus-shadow',
          '',
          'The shadow inside its top edge while focused, which makes it look recessed.',
        ],
        ['--prism-textbox-focus-duration', '350ms', 'How long the focused edge takes to fade in.'],
        ['--prism-textbox-blur-duration', '800ms', 'How long it takes to fade back to the plain border.'],
        ['--prism-textbox-separator', '', 'Colour of the separator.'],
        ['--prism-textbox-separator-height', '16px', 'Height of the separator.'],
        ['--prism-textbox-clear-size', '34px', "The clear button's width; it is as tall as the field."],
        ['--prism-textbox-clear-opacity', '0.65', 'Opacity of the clear icon until it is hovered.'],
        ['--prism-textbox-clear-disabled-opacity', '0.3', 'Opacity of the clear icon when there is nothing to clear.'],
        ['--prism-textbox-focus', '#6d7cff', "The clear button's focus ring."],
        ['--prism-textbox-disabled-opacity', '0.45', 'Opacity of the whole textbox while disabled.'],
        ['--prism-toggle-rim-light', '', 'Colour of the focused rim along its top edge, shared with Toggle.'],
        ['--prism-toggle-rim-side', '', 'Colour of that rim halfway down each end.'],
        ['--prism-toggle-rim-bottom', '', 'Colour of that rim along its bottom edge.'],
        ['--prism-button-rim-width', '1px', 'Width of the border, the rim and the separator.'],
      ]}
    />
  )
}
