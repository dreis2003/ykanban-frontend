import { getContrastTextColor } from '@/features/label/utils/contrastColor'
import styles from './LabelBadge.module.css'

interface Props {
  name: string
  color: string
  onRemove?: () => void
}

/** Nunca renderiza só a cor sem o nome — o nome da Label é sempre visível (ver ADR 0011). */
export function LabelBadge({ name, color, onRemove }: Props) {
  return (
    <span className={styles.badge} style={{ backgroundColor: color, color: getContrastTextColor(color) }}>
      {name}
      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          style={{ color: getContrastTextColor(color) }}
          onClick={onRemove}
          aria-label={`Remover label ${name}`}
        >
          ×
        </button>
      ) : null}
    </span>
  )
}
