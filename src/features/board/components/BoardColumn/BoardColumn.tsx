import { Pencil, Plus } from 'lucide-react'
import type { KanbanColumn } from '@/features/board/types'
import { KanbanCard } from '@/features/card/components/KanbanCard/KanbanCard'
import type { Card } from '@/features/card/types'
import styles from './BoardColumn.module.css'

interface Props {
  column: KanbanColumn
  cards: Card[]
  canManage: boolean
  onEdit: () => void
  canCreateCard: boolean
  onCreateCard: () => void
  onCardClick: (card: Card) => void
}

export function BoardColumn({ column, cards, canManage, onEdit, canCreateCard, onCreateCard, onCardClick }: Props) {
  // position ASC é a ordem de exibição — nunca confiar na ordem de retorno da API por si só.
  const orderedCards = [...cards].sort((a, b) => a.position - b.position)

  return (
    <article className={styles.column} aria-label={column.name}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.nameRow}>
            <h3 className={styles.name}>{column.name}</h3>
            <span className={styles.count}>{cards.length}</span>
          </div>
          {column.wipLimit != null ? <span className={styles.wipLimit}>WIP: {column.wipLimit}</span> : null}
        </div>
        {canManage ? (
          <button type="button" className={styles.editButton} onClick={onEdit} aria-label={`Editar ${column.name}`}>
            <Pencil size={14} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {canCreateCard ? (
        <button type="button" className={styles.createCardButton} onClick={onCreateCard}>
          <Plus size={14} aria-hidden="true" />
          Novo Card
        </button>
      ) : null}

      <div className={styles.body}>
        {orderedCards.length === 0 ? (
          <p className={styles.emptyState}>Nenhum card</p>
        ) : (
          <div className={styles.cardList}>
            {orderedCards.map((card) => (
              <KanbanCard key={card.id} card={card} onClick={() => onCardClick(card)} />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
