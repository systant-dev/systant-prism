import { useState, type ReactNode } from 'react'
import { Card, Menu, MenuButton, type MenuEntry } from '../../src'
import { Copy, DemoPage, Section } from '../layout'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

const page = (
  <Icon>
    <path d="M4 1.5h5L12.5 5v9.5h-8.5zM9 1.5V5h3.5" />
  </Icon>
)
const folder = (
  <Icon>
    <path d="M1.5 3.5h5l1.5 2h6.5v7.5h-13z" />
  </Icon>
)
const bin = (
  <Icon>
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.75 9.5h6.5L12 4" />
  </Icon>
)

// Shows every kind of row, with submenus three levels deep.
function fileMenu(say: (what: string) => void): MenuEntry[] {
  return [
    { label: 'New file', icon: page, shortcut: 'Ctrl+N', onSelect: () => say('New file') },
    { label: 'Open…', icon: folder, shortcut: 'Ctrl+O', onSelect: () => say('Open') },
    {
      type: 'submenu',
      label: 'Open recent',
      items: [
        { label: 'Quarterly report.docx', onSelect: () => say('Quarterly report') },
        { label: 'Budget.xlsx', onSelect: () => say('Budget') },
        {
          type: 'submenu',
          label: 'More',
          items: [
            { label: 'Holiday plans.txt', onSelect: () => say('Holiday plans') },
            { label: 'Invoice 1042.pdf', onSelect: () => say('Invoice') },
          ],
        },
        { type: 'separator' },
        { label: 'Clear recent', onSelect: () => say('Clear recent') },
      ],
    },
    {
      type: 'submenu',
      label: 'Share',
      items: [
        { label: 'Email', onSelect: () => say('Email') },
        { label: 'Copy link', shortcut: 'Ctrl+L', onSelect: () => say('Copy link') },
        { label: 'Publish', disabled: true },
      ],
    },
    { label: 'Save', shortcut: 'Ctrl+S', disabled: true },
    { type: 'separator' },
    { label: 'Documentation', href: 'https://developer.mozilla.org/docs/Web/API/Popover_API', target: '_blank' },
    { label: 'Delete', icon: bin, danger: true, shortcut: 'Del', onSelect: () => say('Delete') },
  ]
}

const themes = ['Light', 'Dark', 'Follow the system']

function ViewMenu() {
  const [ruler, setRuler] = useState(true)
  const [grid, setGrid] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [theme, setTheme] = useState(themes[2])
  return (
    <MenuButton
      variant="secondary"
      items={[
        {
          type: 'group',
          label: 'Show',
          items: [
            { type: 'checkbox', label: 'Ruler', checked: ruler, keepOpen: true, onSelect: () => setRuler(!ruler) },
            { type: 'checkbox', label: 'Grid', checked: grid, keepOpen: true, onSelect: () => setGrid(!grid) },
          ],
        },
        {
          type: 'slider',
          label: 'Zoom',
          value: zoom,
          min: 50,
          max: 200,
          step: 10,
          format: (percent) => `${percent}%`,
          onChange: setZoom,
        },
        { type: 'separator' },
        {
          type: 'group',
          label: 'Theme',
          items: themes.map((name) => ({
            type: 'radio' as const,
            label: name,
            checked: name === theme,
            keepOpen: true,
            onSelect: () => setTheme(name),
          })),
        },
      ]}
    >
      View
    </MenuButton>
  )
}

const months = [
  ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'],
  ...['November', 'December'],
]

const long: MenuEntry[] = [...months, ...months.map((month) => `Next ${month}`)].map((label) => ({ label }))

// A card that opens a menu at the pointer on right-click.
function ContextMenuDemo({ say }: { say: (what: string) => void }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  return (
    <Card
      onContextMenu={(event) => {
        event.preventDefault()
        setAt({ x: event.clientX, y: event.clientY })
      }}
      style={{ minHeight: 160 }}
    >
      <Copy title="Context menu">
        Right-click anywhere in this card. <code>anchor</code> can be a point instead of an element, so the menu opens
        with its corner at the pointer, and flips to stay inside the window.
      </Copy>
      <Menu
        aria-label="Actions"
        open={at !== null}
        onClose={() => setAt(null)}
        anchor={at ?? { x: 0, y: 0 }}
        items={[
          { label: 'Cut', shortcut: 'Ctrl+X', onSelect: () => say('Cut') },
          { label: 'Copy', shortcut: 'Ctrl+C', onSelect: () => say('Copy') },
          { label: 'Paste', shortcut: 'Ctrl+V', disabled: true },
          { type: 'separator' },
          {
            type: 'submenu',
            label: 'Paste as',
            items: [
              { label: 'Plain text', onSelect: () => say('Plain text') },
              { label: 'Markdown', onSelect: () => say('Markdown') },
              { label: 'HTML', onSelect: () => say('HTML') },
            ],
          },
          { label: 'Select all', shortcut: 'Ctrl+A', onSelect: () => say('Select all') },
        ]}
      />
    </Card>
  )
}

export function MenuPage() {
  const [said, say] = useState<string | null>(null)
  return (
    <DemoPage
      name="Menu"
      intro={
        <p style={{ marginTop: 0 }}>
          A menu of actions on a Popup's glass. A submenu overlaps the edge of the menu it opens from, and slides a
          little as it fades in and out. The keyboard works as in any menu: the arrow keys, Home and End move through
          the rows, as does typing the start of a row's label; Enter and Space choose a row, Escape goes back a level
          and Tab closes the menu. The pointer can cut diagonally across to a submenu, and the rows it passes over on
          the way don't close it. A row can have an icon and a shortcut hint, be a checkbox, a radio button, a slider or
          a link, and be disabled or marked as dangerous. Rows can be grouped under a heading and divided by separators.
        </p>
      }
      demos={
        <>
          <Section title="Examples">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignSelf: 'start' }}>
              <MenuButton items={fileMenu(say)}>File</MenuButton>
              <ViewMenu />
              <MenuButton variant="secondary" items={long} menuProps={{ 'aria-label': 'Months' }}>
                Long menu
              </MenuButton>
            </div>
            <ContextMenuDemo say={say} />
            <Card>
              <Copy title="Last chosen">{said ?? 'Choose a row from any of the menus and it is named here.'}</Copy>
            </Card>
          </Section>
        </>
      }
      props={[
        ['open', 'boolean', '', 'Whether it is shown. It fades in and out as this changes.'],
        [
          'onClose',
          '() => void',
          '',
          'Called when a row is chosen, on Tab or Escape, and on a press outside both the menu and its anchor.',
        ],
        ['anchor', 'RefObject<HTMLElement> | { x, y }', '', 'An element to open beside, or a point to open at.'],
        ['items', 'MenuEntry[]', '', 'Its rows, separators and groups. A submenu row has items of its own.'],
        [
          'focusOnOpen',
          "'menu' | 'first' | 'last'",
          "'menu'",
          'What is focused as it opens: the menu itself, with no row highlighted, or its first or last row.',
        ],
        [
          'submenuDelay',
          'number',
          '150',
          'How long the pointer must rest on a submenu row before the submenu opens, in ms.',
        ],
        [
          'submenuOffset',
          'number',
          '-4',
          'Gap between a submenu and the row it opens from, in px. A negative value makes it overlap the edge of the row.',
        ],
        ['side, align, offset', '', '', 'As on a Popup.'],
        ['highlight, refract, readableText', '', '', 'As on a Popup, and applied to every submenu too.'],
        ['', '', '', 'Every other native <div> prop, ref included. An aria-label names the menu.'],
      ]}
      customProperties={[
        ['--prism-menu-min-width', '180px', 'Minimum width of a menu.'],
        [
          '--prism-menu-max-width',
          '340px',
          'Maximum width of a menu. A label too long for it is cut short with an ellipsis.',
        ],
        ['--prism-menu-max-height', '420px', 'The tallest a menu gets before it scrolls.'],
        ['--prism-menu-row-height', '34px', 'Minimum height of a row.'],
        ['--prism-menu-row-radius', '10px', "Corner radius of a row's highlight."],
        ['--prism-menu-active-opacity', '0.12', 'Opacity of the highlight on the active row.'],
        ['--prism-menu-disabled-opacity', '0.45', 'Opacity of a disabled row.'],
        ['--prism-menu-muted-opacity', '0.65', 'Opacity of shortcut hints, submenu chevrons and group headings.'],
        ['--prism-menu-line-opacity', '0.15', 'Opacity of a separator line.'],
        ['--prism-menu-danger', '#e5484d', 'Colour of a dangerous row, mixed with the text colour.'],
        [
          '--prism-menu-submenu-slide',
          '8px',
          'How far a submenu slides sideways as it fades in, and back as it fades out.',
        ],
        ['--prism-menu-slider-thumb-size', '14px', "The size of a slider's thumb."],
        ['--prism-menu-slider-track-height', '4px', "The height of a slider's track."],
        ['--prism-menu-slider-track-opacity', '0.25', "Opacity of the unfilled part of a slider's track."],
      ]}
    />
  )
}
