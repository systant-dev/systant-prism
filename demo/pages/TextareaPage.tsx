import { useState, type CSSProperties } from 'react'
import { Card, Textarea } from '../../src'
import { DemoPage, Section } from '../layout'

const field: CSSProperties = { display: 'grid', gap: 6, marginTop: 12 }

const full: CSSProperties = { width: '100%' }

const LONG =
  'Lanterns along the river, then the long walk up through the old town.\n\nThe last tram leaves at eleven, so there is no need to hurry, but the bakery by the square closes at nine and is worth the climb.'

// The text is kept in this component's state rather than the textarea's, and counted under it.
function Notes() {
  const [notes, setNotes] = useState('Bring a coat')
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Controlled</h3>
      <p>
        With <code>value</code> and <code>onChange</code>, your own state holds the text. The line below counts it.
      </p>
      <Textarea
        aria-label="Notes"
        placeholder="Notes…"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        style={full}
      />
      <p style={{ marginBottom: 0 }}>
        {notes.length} {notes.length === 1 ? 'character' : 'characters'}
      </p>
    </>
  )
}

export function TextareaPage() {
  return (
    <DemoPage
      name="Textarea"
      intro={
        <p style={{ marginTop: 0 }}>
          A multi-line Textbox: the same flat tint and border, the same focused edge, and the same separator and clear
          button, level with the first line. Drag the handle in the bottom corner to resize it, or focus the handle and
          use the arrow keys. Unlike a Textbox, focusing it doesn't select its text: the caret goes where you click.
          Give it an <code>aria-label</code>, or put it in a <code>&lt;label&gt;</code> with its text.
        </p>
      }
      demos={
        <>
          <Section title="Examples">
            {/* Directly on the backdrop, with no card behind them */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', alignSelf: 'start' }}>
              <Textarea aria-label="Message" placeholder="Your message" />
              <Textarea aria-label="Route" defaultValue={LONG} />
            </div>
            <Card>
              <h3 style={{ marginTop: 0 }}>On a card</h3>
              <label style={field}>
                Message
                <Textarea placeholder="Your message" style={full} />
              </label>
            </Card>
            <Card>
              <Notes />
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Disabled and read-only</h3>
              <label style={field}>
                Disabled
                <Textarea disabled rows={2} defaultValue="Can't touch this" style={full} />
              </label>
              <label style={field}>
                Read-only, but still resizable
                <Textarea readOnly rows={2} defaultValue={LONG} style={full} />
              </label>
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>More rows, rounder corners</h3>
              <Textarea
                aria-label="Longer"
                rows={8}
                defaultValue={LONG}
                style={{ ...full, '--prism-textarea-radius': '28px' } as CSSProperties}
              />
            </Card>
          </Section>
        </>
      }
      props={[
        ['rows', 'number', '5', 'Its height in lines of text, until it is resized.'],
        ['clearLabel', 'string', "'Clear'", 'Accessible name of the clear button.'],
        ['resizeLabel', 'string', "'Resize'", 'Accessible name of the resize handle.'],
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
        ['', '', '', 'Every other native <textarea> prop, ref included, is passed to the textarea. Give it a label.'],
      ]}
      customProperties={[
        ['--prism-textarea-width', '320px', "Its starting width, or its container's width if that is narrower."],
        ['--prism-textarea-height', 'auto', 'Its starting height; auto takes it from rows.'],
        ['--prism-textarea-min-width', '160px', 'The narrowest it can be resized to.'],
        ['--prism-textarea-min-height', '72px', 'The shortest it can be resized to.'],
        ['--prism-textarea-radius', '20px', 'Its corner radius.'],
        ['--prism-textarea-line-height', '20px', "The text's line height."],
        ['--prism-textarea-resize-size', '24px', "The resize handle's width and height."],
        [
          '--prism-textbox-*',
          '',
          'Everything else is styled as a Textbox is, by the same custom properties: see Textbox.',
        ],
      ]}
    />
  )
}
