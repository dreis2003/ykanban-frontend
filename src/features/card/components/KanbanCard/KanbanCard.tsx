import { AlertTriangle, Check } from 'lucide-react'
import { CARD_PRIORITY_LABELS, CARD_TYPE_LABELS } from '@/features/card/labels'
import type { Card } from '@/features/card/types'
import { LabelBadge } from '@/features/label/components/LabelBadge/LabelBadge'
import { UserAvatar } from '@/features/user/components/UserAvatar/UserAvatar'
import styles from './KanbanCard.module.css'

/** Mostra no máximo 3 labels no card resumido — o detalhe completo mostra todas (ver ADR 0011). */
const MAX_VISIBLE_LABELS = 3

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
  const visibleLabels = card.labels.slice(0, MAX_VISIBLE_LABELS)
  const hiddenLabelCount = card.labels.length - visibleLabels.length

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
      {card.labels.length > 0 ? (
        <div className={styles.labels}>
          {visibleLabels.map((label) => (
            <LabelBadge key={label.id} name={label.name} color={label.color} />
          ))}
          {hiddenLabelCount > 0 ? <span className={styles.moreLabels}>+{hiddenLabelCount}</span> : null}
        </div>
      ) : null}
      {card.blocked ? (
        <span className={styles.blockedBadge}>
          <AlertTriangle size={12} aria-hidden="true" />
          Bloqueado
        </span>
      ) : null}
      <div className={styles.meta}>
        <span className={styles.type}>{CARD_TYPE_LABELS[card.type]}</span>
        <span className={styles.priority} data-priority={card.priority}>
          {CARD_PRIORITY_LABELS[card.priority]}
        </span>
      </div>
      {totalCriteria > 0 || card.assignee ? (
        <div className={styles.footer}>
          {totalCriteria > 0 ? (
            <span className={styles.criteriaProgress} data-complete={completedCriteria === totalCriteria}>
              {completedCriteria === totalCriteria ? <Check size={12} aria-hidden="true" /> : null}
              {completedCriteria}/{totalCriteria}
            </span>
          ) : (
            <span />
          )}
          {card.assignee ? (
            <UserAvatar id={card.assignee.id} name={card.assignee.name} status={card.assignee.status} />
          ) : null}
        </div>
      ) : null}
    </button>
  )
}
