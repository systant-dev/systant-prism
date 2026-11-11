# Menu

[← Back to the README](../README.md)

A menu of actions on a `Popup`'s glass. For the usual case, `MenuButton` is a [Button](button.md) that opens a menu and keeps track of whether it is open.

```tsx
import { MenuButton, type MenuEntry } from '@systant/prism'

const items: MenuEntry[] = [
  { label: 'New file', shortcut: 'Ctrl+N', onSelect: newFile },
  { label: 'Save', disabled: true },
  {
    type: 'submenu',
    label: 'Share',
    items: [
      { label: 'Email', onSelect: email },
      { label: 'Copy link', onSelect: copyLink },
    ],
  },
  { type: 'separator' },
  { label: 'Documentation', href: '/docs', target: '_blank' },
  { label: 'Delete', danger: true, onSelect: remove },
]

<MenuButton items={items}>File</MenuButton>
```

`Menu` is the menu on its own. It is controlled with `open` and `onClose`, like a `Popup`, so it can be opened from anything. For a context menu, give `anchor` a point:

```tsx
const [at, setAt] = useState<{ x: number; y: number } | null>(null)

<Card
  onContextMenu={(event) => {
    event.preventDefault()
    setAt({ x: event.clientX, y: event.clientY })
  }}
>
  Right-click here
  <Menu
    aria-label="Actions"
    open={at !== null}
    onClose={() => setAt(null)}
    anchor={at ?? { x: 0, y: 0 }}
    items={items}
  />
</Card>
```

**Entries.** Each entry in `items` is one of these, chosen by its `type`. Every row has a `label`, which is also what typed letters are matched against, and can have an `icon` and be `disabled`.

| `type`                |                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'item'`, or left out | An action. `onSelect` is called when it is chosen, `shortcut` is a hint shown at the end of the row (display only: the menu doesn't listen for the keys), `danger` colours it red, and `href` makes it a link.                                          |
| `'checkbox'`          | On or off according to `checked`, with a tick at the end of the row while on. It keeps no state of its own: change `checked` in `onSelect`.                                                                                                             |
| `'radio'`             | One of a set of options; the one with `checked` shows the same tick. Put the set in a group, and change `checked` in `onSelect`.                                                                                                                        |
| `'slider'`            | A number from `min` to `max` (`0` and `100` by default), in steps of `step` (`1`), set with a slider under the label. `format` formats `value` for display at the end of the row. Change `value` in `onChange`. Moving the slider leaves the menu open. |
| `'submenu'`           | Opens a menu of the entries in its own `items` beside it. Submenus can be nested to any depth.                                                                                                                                                          |
| `'group'`             | A set of related rows, in its `items`, under a small heading if it has a `label`.                                                                                                                                                                       |
| `'separator'`         | A line across the menu.                                                                                                                                                                                                                                 |

Choosing a row closes the whole menu, unless the row has `keepOpen`, which suits checkboxes and radio buttons. The focus returns to where it was before the menu opened, and only then is `onSelect` called, so `onSelect` can move the focus on to whatever it opens.

**Submenus.** A submenu opens once the pointer has rested on its row for `submenuDelay`, or immediately on a press. The pointer can cut diagonally across other rows on its way to the submenu without those rows taking over. Where a submenu doesn't fit on the right it opens on the left, and in right-to-left text this is mirrored.

**The keyboard.** The keys follow the ARIA menu pattern:

| Key             |                                                                                     |
| --------------- | ----------------------------------------------------------------------------------- |
| Up and down     | Move through the rows, skipping disabled ones and wrapping round at the ends.       |
| Home and End    | Go to the first and last rows.                                                      |
| Letters         | Move to the row whose label starts with the typed letters.                          |
| Enter and Space | Choose the row, or open its submenu.                                                |
| Right           | Open a submenu, with the focus on its first row.                                    |
| Left            | Go back to the parent menu.                                                         |
| Escape          | Close the most recently opened menu and return the focus to the row that opened it. |
| Tab             | Close every menu and move the focus on from the element that opened them.           |

On a slider row, left, right, Home, End, Page Up and Page Down change the slider's value instead. On a `MenuButton`, Enter, Space and the down arrow open the menu with its first row focused, and the up arrow with its last.

`Menu` takes a `Popup`'s props, `ref` included, except `padding`. It has no label of its own: give it an `aria-label` or an `aria-labelledby`; a `MenuButton` labels its menu for you. It also takes:

| Prop            | Default  |                                                                                                                |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `items`         |          | Its rows, separators and groups.                                                                               |
| `onClose`       |          | Called when a row is chosen, on Tab or Escape, and on a press outside both the menu and its anchor element.    |
| `focusOnOpen`   | `'menu'` | What is focused when it opens: its `'first'` or `'last'` row, or the `'menu'` itself, with no row highlighted. |
| `submenuDelay`  | `150`    | How long the pointer must rest on a submenu's row before the submenu opens, in ms.                             |
| `submenuOffset` | `-4`     | The gap between a submenu and the row it opens from, in px. A negative value makes it overlap the row's edge.  |

`MenuButton` takes a `Button`'s props, `ref` included, plus `items`, `side` and `align`, and `menuProps` for any other props of the menu.

| Property                            | Default   |                                                                                 |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------- |
| `--prism-menu-min-width`            | `180px`   | Minimum width of a menu.                                                        |
| `--prism-menu-max-width`            | `340px`   | Maximum width of a menu. A label too long for it is cut short with an ellipsis. |
| `--prism-menu-max-height`           | `420px`   | The tallest a menu gets before it scrolls.                                      |
| `--prism-menu-row-height`           | `34px`    | Minimum height of a row.                                                        |
| `--prism-menu-row-radius`           | `10px`    | Corner radius of a row's highlight.                                             |
| `--prism-menu-active-opacity`       | `0.12`    | Opacity of the highlight on the active row.                                     |
| `--prism-menu-disabled-opacity`     | `0.45`    | Opacity of a disabled row.                                                      |
| `--prism-menu-muted-opacity`        | `0.65`    | Opacity of shortcut hints, submenu chevrons and group headings.                 |
| `--prism-menu-line-opacity`         | `0.15`    | Opacity of a separator line.                                                    |
| `--prism-menu-danger`               | `#e5484d` | Colour of a dangerous row, mixed with the text colour.                          |
| `--prism-menu-submenu-slide`        | `8px`     | How far a submenu slides sideways as it fades in, and back as it fades out.     |
| `--prism-menu-slider-thumb-size`    | `14px`    | The size of a slider's thumb.                                                   |
| `--prism-menu-slider-track-height`  | `4px`     | The height of a slider's track.                                                 |
| `--prism-menu-slider-track-opacity` | `0.25`    | Opacity of the unfilled part of a slider's track.                               |

The panel is also styled by the `--prism-popup-*` properties.
