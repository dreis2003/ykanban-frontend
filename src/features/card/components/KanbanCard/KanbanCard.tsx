import { CARD_PRIORITY_LABELS, CARD_TYPE_LABELS } from '@/features/card/labels'
import type { Card } from '@/features/card/types'
import styles from './KanbanCard.module.css'

interface Props {
  card: Card
  onClick: () => void
}

export function KanbanCard({ card, onClick }: Props) {
  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <span className={styles.key}>{card.key}</span>
      <span className={styles.title}>{card.title}</span>
      <div className={styles.meta}>
        <span className={styles.type}>{CARD_TYPE_LABELS[card.type]}</span>
        <span className={styles.priority} data-priority={card.priority}>
          {CARD_PRIORITY_LABELS[card.priority]}
        </span>
      </div>
    </button>
  )
}
