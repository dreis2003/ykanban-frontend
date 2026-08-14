import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { boardApi } from '@/features/board/api/boardApi'
import { BoardColumn } from '@/features/board/components/BoardColumn/BoardColumn'
import { EditColumnDialog } from '@/features/board/components/EditColumnDialog/EditColumnDialog'
import { useCardDragAndDrop, type MoveResult } from '@/features/board/hooks/useCardDragAndDrop'
import type { KanbanColumn } from '@/features/board/types'
import { cardApi } from '@/features/card/api/cardApi'
import { CardDetailDialog } from '@/features/card/components/CardDetailDialog/CardDetailDialog'
import { CardFormDialog } from '@/features/card/components/CardFormDialog/CardFormDialog'
import { KanbanCard } from '@/features/card/components/KanbanCard/KanbanCard'
import type { Card } from '@/features/card/types'
import { LabelManagementDialog } from '@/features/label/components/LabelManagementDialog/LabelManagementDialog'
import { ApiError } from '@/shared/api/apiError'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import type { PageResponse } from '@/shared/types/pageResponse'
import styles from './ProjectBoard.module.css'

interface Props {
  projectId: string
  openCardId?: string
  canManage: boolean
  canManageCards: boolean
  isReadOnly: boolean
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

type CardDialogState = { mode: 'create' } | { mode: 'edit'; card: Card } | null

const SKELETON_COLUMNS = Array.from({ length: 6 }, (_, index) => index)

export function ProjectBoard({ projectId, openCardId, canManage, canManageCards, isReadOnly }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null)
  const [columnFormError, setColumnFormError] = useState<string | null>(null)
  const [cardDialog, setCardDialog] = useState<CardDialogState>(null)
  const [cardFormError, setCardFormError] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [labelDialogOpen, setLabelDialogOpen] = useState(false)
  const canEditColumns = canManage && !isReadOnly
  const canEditCards = canManageCards && !isReadOnly

  const {
    data: board,
    isLoading: isBoardLoading,
    isError: isBoardError,
    refetch: refetchBoard,
  } = useQuery({
    queryKey: ['board', projectId],
    queryFn: () => boardApi.get(projectId),
  })

  const {
    data: cardsPage,
    isError: isCardsError,
    refetch: refetchCards,
  } = useQuery({
    queryKey: ['cards', projectId],
    queryFn: () => cardApi.list(projectId),
  })

  const {
    data: openCard,
    isLoading: isOpenCardLoading,
    isError: isOpenCardError,
  } = useQuery({
    queryKey: ['card', openCardId],
    queryFn: () => cardApi.get(openCardId as string),
    enabled: Boolean(openCardId),
  })

  const cardsByColumnId = useMemo(() => {
    const map = new Map<string, Card[]>()
    for (const card of cardsPage?.content ?? []) {
      const existing = map.get(card.column.id) ?? []
      existing.push(card)
      map.set(card.column.id, existing)
    }
    return map
  }, [cardsPage])

  const updateColumnMutation = useMutation({
    mutationFn: ({ columnId, name, wipLimit }: { columnId: string; name: string; wipLimit: number | null }) =>
      boardApi.updateColumn(projectId, columnId, { name, wipLimit }),
    onSuccess: (updatedBoard) => {
      queryClient.setQueryData(['board', projectId], updatedBoard)
      setEditingColumn(null)
      setColumnFormError(null)
    },
    onError: (error: unknown) => setColumnFormError(errorMessageFrom(error)),
  })

  function invalidateCards() {
    return queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
  }

  const createCardMutation = useMutation({
    mutationFn: (payload: Parameters<typeof cardApi.create>[1]) => cardApi.create(projectId, payload),
    onSuccess: () => {
      invalidateCards()
      setCardDialog(null)
      setCardFormError(null)
    },
    onError: (error: unknown) => setCardFormError(errorMessageFrom(error)),
  })

  const updateCardMutation = useMutation({
    mutationFn: ({ cardId, payload }: { cardId: string; payload: Parameters<typeof cardApi.update>[1] }) =>
      cardApi.update(cardId, payload),
    onSuccess: (updatedCard) => {
      invalidateCards()
      queryClient.setQueryData(['card', updatedCard.id], updatedCard)
      setCardDialog(null)
      setCardFormError(null)
      navigate(ROUTES.cardDetail(projectId, updatedCard.id))
    },
    onError: (error: unknown) => setCardFormError(errorMessageFrom(error)),
  })

  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, targetColumnId, targetPosition }: MoveResult) =>
      cardApi.move(cardId, { targetColumnId, targetPosition }),
    onMutate: (result: MoveResult) => {
      // Escreve o cache SINCRONAMENTE (sem await antes) — o hook de drag já zerou o preview local
      // no mesmo evento de soltar o card; se essa escrita fosse assíncrona, o React renderizaria
      // uma vez com preview=null e o cache ainda antigo (card "voltando" para a coluna de origem)
      // antes de renderizar de novo já com o cache atualizado — o "flash" que causava a
      // sensação de arrasto malfeito. Cancelar queries em voo continua necessário (evita que um
      // GET /cards já em andamento sobrescreva o valor otimista com dado desatualizado), só não
      // pode bloquear a escrita síncrona.
      const previous = queryClient.getQueryData<PageResponse<Card>>(['cards', projectId])
      if (previous) {
        queryClient.setQueryData(['cards', projectId], { ...previous, content: result.optimisticCards })
      }
      queryClient.cancelQueries({ queryKey: ['cards', projectId] })
      setMoveError(null)
      return { previous }
    },
    onError: (error: unknown, _result, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cards', projectId], context.previous)
      }
      setMoveError(errorMessageFrom(error))
    },
    onSettled: () => {
      invalidateCards()
    },
  })

  const dragDisabled = !canEditCards
  const dnd = useCardDragAndDrop({
    board,
    cardsByColumnId,
    disabled: dragDisabled,
    onMove: (result) => moveCardMutation.mutate(result),
  })

  const wipBlockedColumnId = useMemo(() => {
    if (!dnd.overColumnId || !dnd.activeCard || !board) {
      return null
    }
    if (dnd.activeCard.column.id === dnd.overColumnId) {
      return null
    }
    const targetColumn = board.columns.find((column) => column.id === dnd.overColumnId)
    if (!targetColumn || targetColumn.wipLimit == null) {
      return null
    }
    const currentCount = cardsByColumnId.get(dnd.overColumnId)?.length ?? 0
    return currentCount >= targetColumn.wipLimit ? dnd.overColumnId : null
  }, [dnd.overColumnId, dnd.activeCard, board, cardsByColumnId])

  function closeColumnEditDialog() {
    setEditingColumn(null)
    setColumnFormError(null)
  }

  function closeCardDialog() {
    setCardDialog(null)
    setCardFormError(null)
  }

  function openCreateCardDialog() {
    setCardFormError(null)
    setCardDialog({ mode: 'create' })
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>Kanban</span>
        {canEditColumns ? (
          <button type="button" className={styles.labelsButton} onClick={() => setLabelDialogOpen(true)}>
            Labels
          </button>
        ) : null}
        {canEditCards ? (
          <button type="button" className={styles.newCardButton} onClick={openCreateCardDialog}>
            <Plus size={16} aria-hidden="true" />
            Novo Card
          </button>
        ) : null}
      </div>

      {isBoardLoading ? (
        <div className={styles.board} aria-hidden="true">
          {SKELETON_COLUMNS.map((index) => (
            <div key={index} className={styles.skeletonColumn} />
          ))}
        </div>
      ) : null}

      {isBoardError ? (
        <StatusMessage
          variant="error"
          title="Não foi possível carregar o quadro."
          action={
            <button type="button" className={styles.retryButton} onClick={() => refetchBoard()}>
              Tentar novamente
            </button>
          }
        />
      ) : null}

      {!isBoardLoading && !isBoardError && board ? (
        <>
          {isCardsError ? (
            <StatusMessage
              variant="error"
              title="Não foi possível carregar os cards."
              action={
                <button type="button" className={styles.retryButton} onClick={() => refetchCards()}>
                  Tentar novamente
                </button>
              }
            />
          ) : null}

          {moveError ? (
            <StatusMessage
              variant="error"
              title={moveError}
              action={
                <button type="button" className={styles.retryButton} onClick={() => setMoveError(null)}>
                  Fechar
                </button>
              }
            />
          ) : null}

          <DndContext
            sensors={dnd.sensors}
            onDragStart={dnd.handleDragStart}
            onDragOver={dnd.handleDragOver}
            onDragEnd={dnd.handleDragEnd}
            onDragCancel={dnd.handleDragCancel}
          >
            <div className={styles.board} role="list" aria-label="Colunas do Kanban">
              {board.columns.map((column) => (
                <div role="listitem" key={column.id} data-column-id={column.id}>
                  <BoardColumn
                    column={column}
                    cards={dnd.displayCardsByColumnId.get(column.id) ?? []}
                    canManage={canEditColumns}
                    onEdit={() => setEditingColumn(column)}
                    canCreateCard={canEditCards && column.type === 'BACKLOG'}
                    onCreateCard={openCreateCardDialog}
                    onCardClick={(card) => navigate(ROUTES.cardDetail(projectId, card.id))}
                    dragDisabled={dragDisabled}
                    wipBlocked={wipBlockedColumnId === column.id}
                  />
                </div>
              ))}
            </div>
            <DragOverlay>{dnd.activeCard ? <KanbanCard card={dnd.activeCard} onClick={() => {}} /> : null}</DragOverlay>
          </DndContext>
        </>
      ) : null}

      <LabelManagementDialog open={labelDialogOpen} projectId={projectId} onClose={() => setLabelDialogOpen(false)} />

      <EditColumnDialog
        open={editingColumn !== null}
        column={editingColumn}
        isSubmitting={updateColumnMutation.isPending}
        errorMessage={columnFormError}
        onSubmit={(values) => {
          if (editingColumn) {
            updateColumnMutation.mutate({ columnId: editingColumn.id, ...values })
          }
        }}
        onClose={closeColumnEditDialog}
      />

      <CardDetailDialog
        open={Boolean(openCardId)}
        card={openCard ?? null}
        isLoading={isOpenCardLoading}
        isError={isOpenCardError}
        canManage={canEditCards}
        canManageLabelsCatalog={canEditColumns}
        onEdit={() => {
          if (openCard) {
            setCardFormError(null)
            setCardDialog({ mode: 'edit', card: openCard })
            navigate(ROUTES.projectDetail(projectId))
          }
        }}
        onClose={() => navigate(ROUTES.projectDetail(projectId))}
      />

      <CardFormDialog
        mode={cardDialog?.mode ?? 'create'}
        open={cardDialog !== null}
        card={cardDialog?.mode === 'edit' ? cardDialog.card : null}
        isSubmitting={createCardMutation.isPending || updateCardMutation.isPending}
        errorMessage={cardFormError}
        onSubmit={(values) => {
          if (cardDialog?.mode === 'create') {
            createCardMutation.mutate({
              title: values.title,
              type: values.type,
              priority: values.priority,
              ...(values.description ? { description: values.description } : {}),
            })
          } else if (cardDialog?.mode === 'edit') {
            updateCardMutation.mutate({
              cardId: cardDialog.card.id,
              payload: {
                title: values.title,
                type: values.type,
                priority: values.priority,
                ...(values.description ? { description: values.description } : {}),
              },
            })
          }
        }}
        onClose={closeCardDialog}
      />
    </div>
  )
}
