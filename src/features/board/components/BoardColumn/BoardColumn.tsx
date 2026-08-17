import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { AlertTriangle, Pencil, Plus } from 'lucide-react'
import { columnDroppableId } from '@/features/board/hooks/useCardDragAndDrop'
import type { KanbanColumn } from '@/features/board/types'
import { resolveWipStatus } from '@/features/board/utils/wipStatus'
import type { Card } from '@/features/card/types'
import { SortableKanbanCard } from './SortableKanbanCard'
import styles from './BoardColumn.module.css'

interface Props {
  column: KanbanColumn
  cards: Card[]
  canManage: boolean
  onEdit: () => void
  canCreateCard: boolean
  onCreateCard: () => void
  onCardClick: (card: Card) => void
  dragDisabled: boolean
  wipBlocked: boolean
  /** Card bloqueado sendo arrastado sobre uma coluna posterior no fluxo — o backend é sempre a
   * autoridade (rejeita com 409 e o board reverte), isto é só um aviso durante o arrasto, mesmo
   * padrão já usado para `wipBlocked`. */
  cardBlockedFromAdvancing: boolean
  emptyStateMessage: string
  /** Ver ADR 0017 — com filtro/pesquisa ativo, `cards` (exibidos) pode ser menor que
   * `column.cardCount` (real); o WIP sempre usa o real, nunca a visão filtrada. */
  hasActiveFilters: boolean
}

export function BoardColumn({
  column,
  cards,
  canManage,
  onEdit,
  canCreateCard,
  onCreateCard,
  onCardClick,
  dragDisabled,
  wipBlocked,
  cardBlockedFromAdvancing,
  emptyStateMessage,
  hasActiveFilters,
}: Props) {
  // position ASC é a ordem de exibição — nunca confiar na ordem de retorno da API por si só.
  const orderedCards = [...cards].sort((a, b) => a.position - b.position)
  const wipStatus = resolveWipStatus(column.wipLimit, column.cardCount)
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(column.id), disabled: dragDisabled })

  return (
    <article className={styles.column} aria-label={column.name} data-column-type={column.type}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.nameRow}>
            <h3 className={styles.name}>{column.name}</h3>
            <span className={styles.count}>{cards.length}</span>
          </div>
          {column.wipLimit != null ? (
            <div
              className={styles.wipLimit}
              data-wip-status={wipStatus}
              title={
                wipStatus === 'OVER_LIMIT'
                  ? `${column.cardCount - column.wipLimit} cards acima do limite de WIP`
                  : undefined
              }
            >
              <span className={styles.wipCount}>
                {hasActiveFilters && cards.length !== column.cardCount ? `${cards.length} visível · ` : ''}
                {column.cardCount} / {column.wipLimit}
              </span>
              {wipStatus === 'AT_LIMIT' ? <span className={styles.wipStatusText}>Limite atingido</span> : null}
              {wipStatus === 'OVER_LIMIT' ? (
                <span className={styles.wipStatusText}>
                  <AlertTriangle size={12} aria-hidden="true" /> Acima do limite
                </span>
              ) : null}
            </div>
          ) : null}
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
          Adicionar card
        </button>
      ) : null}

      <div
        ref={setNodeRef}
        className={styles.body}
        data-drop-active={isOver}
        data-drop-blocked={isOver && (wipBlocked || cardBlockedFromAdvancing)}
      >
        {isOver && cardBlockedFromAdvancing ? (
          <p className={styles.dropWarning} role="status">
            🚫 Card bloqueado não pode avançar
          </p>
        ) : null}
        {orderedCards.length === 0 ? (
          <p className={styles.emptyState}>{emptyStateMessage}</p>
        ) : (
          <SortableContext items={orderedCards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
            <ul className={styles.cardList} aria-label={`Cards de ${column.name}`}>
              {orderedCards.map((card) => (
                <SortableKanbanCard key={card.id} card={card} onClick={() => onCardClick(card)} disabled={dragDisabled} />
              ))}
            </ul>
          </SortableContext>
        )}
      </div>
    </article>
  )
}
