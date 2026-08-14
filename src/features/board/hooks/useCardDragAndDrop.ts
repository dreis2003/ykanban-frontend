import { useMemo, useState } from 'react'
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Board } from '@/features/board/types'
import type { Card } from '@/features/card/types'

const COLUMN_DROPPABLE_PREFIX = 'column:'

export function columnDroppableId(columnId: string): string {
  return `${COLUMN_DROPPABLE_PREFIX}${columnId}`
}

function isColumnDroppableId(id: string): boolean {
  return id.startsWith(COLUMN_DROPPABLE_PREFIX)
}

function columnIdFromDroppableId(id: string): string {
  return id.slice(COLUMN_DROPPABLE_PREFIX.length)
}

export interface MoveResult {
  cardId: string
  targetColumnId: string
  targetPosition: number
  /** Estado final de todos os cards do projeto já refletindo a movimentação — usado pelo caller
   * para aplicar optimistic update direto no cache do React Query, sem esperar o refetch. */
  optimisticCards: Card[]
}

interface UseCardDragAndDropOptions {
  board: Board | undefined
  cardsByColumnId: Map<string, Card[]>
  disabled: boolean
  onMove: (result: MoveResult) => void
}

function sortedClone(cardsByColumnId: Map<string, Card[]>): Map<string, Card[]> {
  const clone = new Map<string, Card[]>()
  for (const [columnId, cards] of cardsByColumnId) {
    clone.set(columnId, [...cards].sort((a, b) => a.position - b.position))
  }
  return clone
}

function findColumnIdOfCard(cardsByColumnId: Map<string, Card[]>, cardId: string): string | null {
  for (const [columnId, cards] of cardsByColumnId) {
    if (cards.some((card) => card.id === cardId)) {
      return columnId
    }
  }
  return null
}

/** Achata o preview de arrasto em vigor num array único, com `position`/`column` corrigidos por
 * card — é exatamente o que o backend recalcula ao resequenciar, então o optimistic update fica
 * consistente com o que a resposta autoritativa deve confirmar. */
function finalizePreview(preview: Map<string, Card[]>, board: Board): Card[] {
  const result: Card[] = []
  for (const column of board.columns) {
    const list = preview.get(column.id) ?? []
    list.forEach((card, index) => {
      result.push({
        ...card,
        position: index + 1,
        column: { id: column.id, type: column.type, name: column.name },
      })
    })
  }
  return result
}

/**
 * Estado de drag-and-drop de Cards entre/dentro de colunas do Kanban — ver ADR 0009.
 *
 * Sensores deliberadamente separados por dispositivo (em vez de um único PointerSensor): mouse usa
 * distância mínima antes de iniciar o arrasto (permite clique normal abrir o detalhe do card);
 * touch usa atraso (long-press) em vez de distância, porque um PointerSensor com distância mínima
 * intercepta o gesto de rolagem por toque antes do navegador — usar TouchSensor com delay evita
 * roubar o scroll normal da coluna em dispositivos móveis (ver agent_docs, seção de acessibilidade).
 */
export function useCardDragAndDrop({ board, cardsByColumnId, disabled, onMove }: UseCardDragAndDropOptions) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Map<string, Card[]> | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeCard = useMemo(() => {
    if (!activeCardId) return null
    for (const cards of cardsByColumnId.values()) {
      const found = cards.find((card) => card.id === activeCardId)
      if (found) return found
    }
    return null
  }, [activeCardId, cardsByColumnId])

  function resetDrag() {
    setActiveCardId(null)
    setOverColumnId(null)
    setPreview(null)
  }

  function handleDragStart(event: DragStartEvent) {
    if (disabled) return
    setActiveCardId(String(event.active.id))
    setPreview(sortedClone(cardsByColumnId))
  }

  function handleDragOver(event: DragOverEvent) {
    if (disabled || !preview) return
    const { active, over } = event
    if (!over) {
      setOverColumnId(null)
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    const sourceColumnId = findColumnIdOfCard(preview, activeId)
    const targetColumnId = isColumnDroppableId(overId)
      ? columnIdFromDroppableId(overId)
      : findColumnIdOfCard(preview, overId)
    if (!sourceColumnId || !targetColumnId) return
    setOverColumnId(targetColumnId)

    const sourceList = preview.get(sourceColumnId) ?? []
    const activeIndex = sourceList.findIndex((card) => card.id === activeId)
    if (activeIndex === -1) return

    if (sourceColumnId === targetColumnId) {
      const overIndex = isColumnDroppableId(overId) ? sourceList.length - 1 : sourceList.findIndex((card) => card.id === overId)
      if (overIndex === -1 || overIndex === activeIndex) return
      const next = new Map(preview)
      next.set(sourceColumnId, arrayMove(sourceList, activeIndex, overIndex))
      setPreview(next)
      return
    }

    const targetList = preview.get(targetColumnId) ?? []
    const movingCard = sourceList[activeIndex]
    if (!movingCard) return
    const overIndex = isColumnDroppableId(overId) ? targetList.length : targetList.findIndex((card) => card.id === overId)
    const insertionIndex = overIndex === -1 ? targetList.length : overIndex

    const next = new Map(preview)
    next.set(
      sourceColumnId,
      sourceList.filter((card) => card.id !== activeId),
    )
    const newTargetList = [...targetList]
    newTargetList.splice(insertionIndex, 0, movingCard)
    next.set(targetColumnId, newTargetList)
    setPreview(next)
  }

  function handleDragEnd(_event: DragEndEvent) {
    const activeId = activeCardId
    const finalPreview = preview
    resetDrag()
    if (disabled || !activeId || !finalPreview || !board) return

    const targetColumnId = findColumnIdOfCard(finalPreview, activeId)
    if (!targetColumnId) return
    const targetList = finalPreview.get(targetColumnId) ?? []
    const targetPosition = targetList.findIndex((card) => card.id === activeId) + 1
    if (targetPosition < 1) return

    onMove({
      cardId: activeId,
      targetColumnId,
      targetPosition,
      optimisticCards: finalizePreview(finalPreview, board),
    })
  }

  function handleDragCancel(_event: DragCancelEvent) {
    resetDrag()
  }

  return {
    sensors,
    activeCard,
    overColumnId,
    displayCardsByColumnId: preview ?? cardsByColumnId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
