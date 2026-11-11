import { useState, type CSSProperties } from 'react'
import { Card, Combobox } from '../../src'
import { DemoPage, Section } from '../layout'

const field: CSSProperties = { display: 'grid', gap: 6, marginTop: 12 }

const full: CSSProperties = { width: '100%' }

const fruit = [
  'Apple',
  'Apricot',
  'Banana',
  'Blackcurrant',
  'Cherry',
  'Damson',
  'Elderberry',
  'Fig',
  'Grape',
  'Kiwi',
  'Lemon',
  'Lime',
  'Mango',
  'Nectarine',
  'Orange',
  'Peach',
  'Pear',
  'Pineapple',
  'Plum',
  'Raspberry',
  'Strawberry',
].map((name) => ({ value: name.toLowerCase(), label: name }))

const toppings = [
  { value: 'almonds', label: 'Almonds' },
  { value: 'cream', label: 'Cream' },
  { value: 'honey', label: 'Honey' },
  { value: 'peanuts', label: 'Peanuts (sold out)', disabled: true },
  { value: 'sugar', label: 'Sugar' },
]

// The selection is kept in this component's state rather than the combobox's, and listed under it.
function Controlled() {
  const [value, setValue] = useState(['mango', 'peach'])
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Controlled</h3>
      <p>
        With <code>value</code> and <code>onChange</code>, your own state holds the selection. The line below reads it.
      </p>
      <Combobox aria-label="Fruit" items={fruit} value={value} onChange={setValue} style={full} />
      <p style={{ marginBottom: 0 }}>
        {value.length ? `Selected, in the order picked: ${value.join(', ')}` : 'Nothing selected'}
      </p>
    </>
  )
}

export function ComboboxPage() {
  return (
    <DemoPage
      name="Combobox"
      intro={
        <p style={{ marginTop: 0 }}>
          A Textbox with a list of entries in a Popup under it. Type to filter the list, then select as many entries as
          you like: each selected entry is marked with a tick, and the list stays open so you can pick more. Enter
          selects the best match, and the arrow keys move through the list. When the field loses focus, it shows the
          selected entries. Give it an <code>aria-label</code>, or put it in a <code>&lt;label&gt;</code> with its text.
        </p>
      }
      demos={
        <>
          <Section title="Examples">
            {/* Directly on the backdrop, the same as on the Textbox page */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', alignSelf: 'start' }}>
              <Combobox aria-label="Fruit" items={fruit} placeholder="Pick some fruit" />
            </div>
            <Card>
              <h3 style={{ marginTop: 0 }}>On a card</h3>
              <label style={field}>
                Fruit
                <Combobox items={fruit} defaultValue={['apple', 'cherry']} style={full} />
              </label>
              <label style={field}>
                Toppings, with one entry disabled
                <Combobox items={toppings} placeholder="Pick toppings" style={full} />
              </label>
            </Card>
            <Card>
              <Controlled />
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Single selection</h3>
              <p style={{ marginBottom: 0 }}>
                With <code>multiple={'{false}'}</code>, picking an entry replaces the one before and closes the list.
              </p>
              <label style={field}>
                Favourite fruit
                <Combobox items={fruit} multiple={false} defaultValue={['mango']} style={full} />
              </label>
            </Card>
            <Card>
              <h3 style={{ marginTop: 0 }}>Disabled and read-only</h3>
              <label style={field}>
                Disabled
                <Combobox disabled items={fruit} defaultValue={['fig']} style={full} />
              </label>
              <label style={field}>
                Read-only
                <Combobox readOnly items={fruit} defaultValue={['fig', 'plum']} style={full} />
              </label>
            </Card>
          </Section>
        </>
      }
      props={[
        [
          'items',
          'ComboboxItem[]',
          '',
          'The entries to choose from. Each has a value, a label and, optionally, disabled.',
        ],
        [
          'match',
          '(query: string) => ComboboxItem[]',
          '',
          'Returns the entries to list for the typed text, replacing the built-in filtering of items.',
        ],
        [
          'onCommitText',
          '(text: string) => void',
          '',
          'With multiple false: called with the typed text when Enter is pressed, or the field loses focus, without an entry being picked. It lets the field accept a value that is not in the list.',
        ],
        [
          'multiple',
          'boolean',
          'true',
          'Whether several entries can be selected. With false only one can, and picking it closes the list.',
        ],
        [
          'value',
          'string[]',
          '',
          'The selected values; at most one when multiple is false. Leave it out and the combobox keeps track of the selection itself.',
        ],
        ['defaultValue', 'string[]', '[]', 'The values selected at first, when value is left out.'],
        ['onChange', '(value: string[]) => void', '', 'Called with all the selected values, in the order picked.'],
        ['noMatchesLabel', 'string', "'No matches'", 'The text shown in the list when nothing matches.'],
        ['clearLabel', 'string', "'Clear'", 'Accessible name of the clear button.'],
        ['refract', 'boolean', 'true', 'Glass effect on the list: blurs the backdrop and bends it at the edges.'],
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
        ['--prism-combobox-max-height', '240px', 'The tallest the list gets before it scrolls.'],
        ['--prism-combobox-option-height', '36px', 'Minimum height of an entry.'],
        ['--prism-combobox-option-radius', '10px', "Corner radius of an entry's highlight."],
        ['--prism-combobox-active-opacity', '0.12', 'Opacity of the highlight on the active entry.'],
        ['--prism-combobox-disabled-opacity', '0.45', 'Opacity of a disabled entry.'],
        ['--prism-combobox-empty-opacity', '0.7', 'Opacity of the "no matches" line.'],
        ['--prism-textbox-*', '', 'The field itself: see Textbox.'],
        ['--prism-popup-*', '', 'The panel holding the list: see Popup.'],
      ]}
    />
  )
}
