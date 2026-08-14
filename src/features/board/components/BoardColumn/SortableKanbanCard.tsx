import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { KanbanCard } from '@/features/card/components/KanbanCard/KanbanCard'
import type { Card } from '@/features/card/types'
import styles from './BoardColumn.module.css'

interface Props {
  card: Card
  onClick: () => void
  disabled: boolean
}

export function SortableKanbanCard({ card, onClick, disabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled,
  })

  return (
    <li
      ref={setNodeRef}
      data-card-id={card.id}
      data-dragging={isDragging}
      className={styles.sortableItem}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <KanbanCard card={card} onClick={onClick} {...(disabled ? {} : { dragHandleProps: { ...attributes, ...listeners } })} />
    </li>
  )
}
