import { Check } from 'lucide-react'
import { CARD_PRIORITY_LABELS, CARD_TYPE_LABELS } from '@/features/card/labels'
import type { Card } from '@/features/card/types'
import styles from './KanbanCard.module.css'

interface Props {
  card: Card
  onClick: () => void
  /** Atributos/listeners do dnd-kit (useSortable) — o botão serve como alça de arrasto e alvo de
   * clique ao mesmo tempo; a distinção entre os dois fica a cargo do sensor (distância mínima no
   * mouse, long-press no touch), não deste componente. Ver useCardDragAndDrop. */
  dragHandleProps?: Record<string, unknown>
}

export function KanbanCard({ card, onClick, dragHandleProps }: Props) {
  const totalCriteria = card.acceptanceCriteria.length
  const completedCriteria = card.acceptanceCriteria.filter((criterion) => criterion.completed).length

  return (
    <button
      type="button"
      className={styles.card}
      onClick={onClick}
      data-card-id={card.id}
      {...dragHandleProps}
    >
      <span className={styles.key}>{card.key}</span>
      <span className={styles.title}>{card.title}</span>
      <div className={styles.meta}>
        <span className={styles.type}>{CARD_TYPE_LABELS[card.type]}</span>
        <span className={styles.priority} data-priority={card.priority}>
          {CARD_PRIORITY_LABELS[card.priority]}
        </span>
      </div>
      {totalCriteria > 0 ? (
        <span className={styles.criteriaProgress} data-complete={completedCriteria === totalCriteria}>
          {completedCriteria === totalCriteria ? <Check size={12} aria-hidden="true" /> : null}
          {completedCriteria}/{totalCriteria}
        </span>
      ) : null}
    </button>
  )
}
