import { LABEL_COLOR_PALETTE } from '@/features/label/constants'
import styles from './LabelColorPicker.module.css'

interface Props {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/

export function LabelColorPicker({ value, onChange, disabled }: Props) {
  const isValidHex = HEX_PATTERN.test(value)

  return (
    <div className={styles.picker}>
      <div className={styles.swatches} role="group" aria-label="Cores predefinidas">
        {LABEL_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={styles.swatch}
            data-selected={value.toLowerCase() === color.toLowerCase()}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            disabled={disabled}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            aria-label={`Selecionar cor ${color}`}
          />
        ))}
      </div>
      <input
        type="text"
        className={styles.hexInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="#RRGGBB"
        maxLength={7}
        aria-label="Cor personalizada em hexadecimal"
        aria-invalid={!isValidHex}
      />
      <span className={styles.preview} style={isValidHex ? { backgroundColor: value } : undefined} aria-hidden="true" />
    </div>
  )
}
