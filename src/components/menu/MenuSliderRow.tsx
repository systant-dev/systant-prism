import type { HTMLAttributes, Ref } from 'react'
import { cssVars } from '../../shared'
import type { MenuSlider } from './menuEntries'

interface MenuSliderRowProps extends Pick<HTMLAttributes<HTMLElement>, 'onPointerMove' | 'onPointerLeave'> {
  row: MenuSlider
  /** The slider itself, which is what takes the focus. */
  ref: Ref<HTMLInputElement>
}

// A row of a menu with a slider under its label and its value at its end, on the
// same four columns as every other row (Menu.styles.ts). The slider is a native
// range input, for the dragging, the keys and all that a screen reader is told, and
// it is what takes the focus, so the row around it lights up as the others do.
export function MenuSliderRow({ row, ref, ...handlers }: MenuSliderRowProps) {
  const { label, icon, value, min = 0, max = 100, step = 1, onChange, format = String, disabled } = row
  const shown = format(value)
  return (
    <div role="none" className="prism-menu__item prism-menu__item--slider" {...handlers}>
      {icon && <span className="prism-menu__lead">{icon}</span>}
      <span className="prism-menu__label">{label}</span>
      <span className="prism-menu__value">{shown}</span>
      <input
        ref={ref}
        type="range"
        role="slider"
        tabIndex={disabled ? undefined : -1}
        aria-label={label}
        aria-valuetext={shown}
        aria-disabled={disabled || undefined}
        data-label={label}
        className="prism-menu__slider"
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={value}
        style={cssVars({ '--_prism-menu-slider-at': (value - min) / (max - min) })}
        onChange={(event) => onChange?.(event.currentTarget.valueAsNumber)}
      />
    </div>
  )
}
