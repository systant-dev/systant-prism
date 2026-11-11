import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from 'react'
import { Card, DynamicBackground, Fade, MenuButton, ScrollArea, VerticalSelector, type DynamicScene } from '../src'
import { ButtonPage } from './pages/ButtonPage'
import { CalendarPage } from './pages/CalendarPage'
import { CardGridPage } from './pages/CardGridPage'
import { CardPage } from './pages/CardPage'
import { ComboboxPage } from './pages/ComboboxPage'
import { DataGridPage } from './pages/DataGridPage'
import { DynamicBackgroundPage } from './pages/DynamicBackgroundPage'
import { HorizontalSelectorPage } from './pages/HorizontalSelectorPage'
import { IntroPage } from './pages/IntroPage'
import { MenuPage } from './pages/MenuPage'
import { PopupPage } from './pages/PopupPage'
import { ProgressPage } from './pages/ProgressPage'
import { TextareaPage } from './pages/TextareaPage'
import { TextboxPage } from './pages/TextboxPage'
import { TogglePage } from './pages/TogglePage'
import { VerticalSelectorPage } from './pages/VerticalSelectorPage'

/** How far the time of day moves at a step of its slider, in minutes. */
const TIME_STEP = 5

/** The last minute of the day. */
const LAST_MINUTE = 24 * 60 - 1

function minutesNow() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function clockTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// `?time=21:30` in the URL starts the page with the time of day set to that.
const timeInUrl = new URLSearchParams(location.search).get('time')?.split(':').map(Number)
const startingTime = timeInUrl ? timeInUrl[0] * 60 + (timeInUrl[1] ?? 0) : null

const backgrounds: { name: string; scene: DynamicScene }[] = [
  { name: 'Forest', scene: 'forest' },
  { name: 'Ocean', scene: 'ocean' },
]

const layout: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  gap: 16,
  padding: 16,
  boxSizing: 'border-box',
}

// The page's fade, slower than a Fade's default (150ms out, 200ms in, overlapping 60ms).
const pageFade = {
  '--prism-fade-out-duration': '250ms',
  '--prism-fade-in-duration': '350ms',
  '--prism-fade-overlap': '100ms',
} as CSSProperties

interface Page {
  id: string
  name: string
  Page: ComponentType
}

const intro: Page = { id: 'intro', name: 'Intro', Page: IntroPage }

const components: Page[] = [
  { id: 'button', name: 'Button', Page: ButtonPage },
  { id: 'card', name: 'Card', Page: CardPage },
  { id: 'card-grid', name: 'CardGrid', Page: CardGridPage },
  { id: 'combobox', name: 'Combobox', Page: ComboboxPage },
  { id: 'calendar', name: 'Calendar', Page: CalendarPage },
  { id: 'data-grid', name: 'DataGrid', Page: DataGridPage },
  { id: 'dynamic-background', name: 'DynamicBackground', Page: DynamicBackgroundPage },
  { id: 'popup', name: 'Popup', Page: PopupPage },
  { id: 'menu', name: 'Menu', Page: MenuPage },
  { id: 'progress', name: 'Progress', Page: ProgressPage },
  { id: 'textbox', name: 'Textbox', Page: TextboxPage },
  { id: 'textarea', name: 'Textarea', Page: TextareaPage },
  { id: 'toggle', name: 'Toggle', Page: TogglePage },
  { id: 'vertical-selector', name: 'VerticalSelector', Page: VerticalSelectorPage },
  { id: 'horizontal-selector', name: 'HorizontalSelector', Page: HorizontalSelectorPage },
]

// The page showing is not kept in the URL: the demo always opens, and reloads, with
// none, on the background alone. A hash left in the URL by an older link is dropped.
if (location.hash) history.replaceState(null, '', location.pathname + location.search)

function CogIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

interface BackgroundPickerProps {
  /** The name of the background showing. */
  value: string
  onChange: (name: string) => void
  animated: boolean
  onAnimated: (animated: boolean) => void
  rain: boolean
  onRain: (rain: boolean) => void
  /** The time of day set by hand, in minutes; null while it follows the local time. */
  time: number | null
  onTime: (time: number | null) => void
}

// A cog that opens a menu to pick the page background from and set how it behaves,
// below the cog with its left edge on the cog's, over the page beside the sidebar.
// It stays open while you try them; Escape or a press elsewhere closes it. While the
// time of day follows the local time, its slider shows that, and it is from there
// that it sets out once it is let go of, so the sky doesn't jump.
function BackgroundPicker({
  value,
  onChange,
  animated,
  onAnimated,
  rain,
  onRain,
  time,
  onTime,
}: BackgroundPickerProps) {
  const [clock, setClock] = useState(minutesNow)

  useEffect(() => {
    const timer = setInterval(() => setClock(minutesNow()), 15_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <MenuButton
      aria-label="Background"
      items={[
        {
          type: 'group',
          label: 'Background',
          items: backgrounds.map((background) => ({
            type: 'radio' as const,
            label: background.name.replaceAll('-', ' '),
            checked: background.name === value,
            keepOpen: true,
            onSelect: () => onChange(background.name),
          })),
        },
        { type: 'separator' },
        {
          type: 'checkbox',
          label: 'Animations',
          checked: animated,
          keepOpen: true,
          onSelect: () => onAnimated(!animated),
        },
        {
          type: 'checkbox',
          label: 'Rain',
          checked: rain,
          keepOpen: true,
          onSelect: () => onRain(!rain),
        },
        { type: 'separator' },
        {
          type: 'checkbox',
          label: 'Follow local time',
          checked: time === null,
          keepOpen: true,
          onSelect: () => onTime(time === null ? clock - (clock % TIME_STEP) : null),
        },
        {
          type: 'slider',
          label: 'Time of day',
          value: time ?? clock,
          max: LAST_MINUTE,
          step: TIME_STEP,
          format: clockTime,
          disabled: time === null,
          onChange: onTime,
        },
      ]}
      // Down 4px so the cog centres on the title's letters rather than its line box,
      // whose Outfit ascent leaves the ink sitting below the box's middle
      style={{ padding: 10, top: 4 }}
    >
      <CogIcon />
    </MenuButton>
  )
}

export function App() {
  // By name: a hot update makes `backgrounds` anew and keeps the state, which would
  // then match none of them, and leave the menu with no background ticked.
  const [backgroundName, setBackgroundName] = useState('Ocean')
  const background = backgrounds.find((b) => b.name === backgroundName)!
  const [animated, setAnimated] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [rain, setRain] = useState(false)
  const [time, setTime] = useState(startingTime)
  const [selected, setSelected] = useState<Page | null>(null)
  // Made once per page, as dragging the time of day renders all of this over and over.
  const page = useMemo(() => selected && <selected.Page key={selected.id} />, [selected])

  return (
    <DynamicBackground scene={background.scene} animated={animated} rain={rain} time={time} style={layout}>
      {/* The card and its title stay put; the rest scrolls inside it */}
      <Card padding="none" style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
          <h1 style={{ margin: 0, flex: 1, minWidth: 0 }}>systant-prism</h1>
          <BackgroundPicker
            value={backgroundName}
            onChange={setBackgroundName}
            animated={animated}
            onAnimated={setAnimated}
            rain={rain}
            onRain={setRain}
            time={time}
            onTime={setTime}
          />
        </header>
        {/* Only vertically: button halos spill a little past their edges, which would add a sideways scrollbar */}
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <div style={{ padding: 20 }}>
            {/* A list of its own above the components; each list shows its pill only while its page is the one showing */}
            <VerticalSelector
              aria-label="Introduction"
              items={[{ value: intro.id, label: intro.name }]}
              value={selected?.id}
              onChange={() => setSelected(intro)}
            />
            <h2 style={{ fontSize: 18 }}>Components</h2>
            <VerticalSelector
              aria-label="Components"
              items={components.map((c) => ({ value: c.id, label: c.name }))}
              value={selected?.id}
              onChange={(id) => setSelected(components.find((c) => c.id === id)!)}
            />
          </div>
        </ScrollArea>
      </Card>

      {/* Fades out and the next in as the page changes, more slowly than a Fade's default, as a whole page goes. Keyed so the new page starts on its demos, at the top. Empty until a page is picked */}
      <Fade contentKey={selected?.id ?? 'none'} style={{ ...pageFade, flex: 1, minWidth: 0 }}>
        {page}
      </Fade>
    </DynamicBackground>
  )
}
