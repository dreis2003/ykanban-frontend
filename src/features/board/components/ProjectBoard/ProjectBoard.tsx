import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { boardApi } from '@/features/board/api/boardApi'
import { BoardColumn } from '@/features/board/components/BoardColumn/BoardColumn'
import { EditColumnDialog } from '@/features/board/components/EditColumnDialog/EditColumnDialog'
import type { KanbanColumn } from '@/features/board/types'
import { cardApi } from '@/features/card/api/cardApi'
import { CardDetailDialog } from '@/features/card/components/CardDetailDialog/CardDetailDialog'
import { CardFormDialog } from '@/features/card/components/CardFormDialog/CardFormDialog'
import type { Card } from '@/features/card/types'
import { ApiError } from '@/shared/api/apiError'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ProjectBoard.module.css'

interface Props {
  projectId: string
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

export function ProjectBoard({ projectId, canManage, canManageCards, isReadOnly }: Props) {
  const queryClient = useQueryClient()
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null)
  const [columnFormError, setColumnFormError] = useState<string | null>(null)
  const [viewingCard, setViewingCard] = useState<Card | null>(null)
  const [cardDialog, setCardDialog] = useState<CardDialogState>(null)
  const [cardFormError, setCardFormError] = useState<string | null>(null)
  const canEditColumns = canManage && !isReadOnly
  const canEditCards = canManageCards && !isReadOnly

  const { data: board, isLoading: isBoardLoading, isError: isBoardError } = useQuery({
    queryKey: ['board', projectId],
    queryFn: () => boardApi.get(projectId),
  })

  const {
    data: cardsPage,
    isLoading: isCardsLoading,
    isError: isCardsError,
  } = useQuery({
    queryKey: ['cards', projectId],
    queryFn: () => cardApi.list(projectId),
  })

  const isLoading = isBoardLoading || isCardsLoading
  const isError = isBoardError || isCardsError

  const cardsByColumnId = new Map<string, Card[]>()
  for (const card of cardsPage?.content ?? []) {
    const existing = cardsByColumnId.get(card.column.id) ?? []
    existing.push(card)
    cardsByColumnId.set(card.column.id, existing)
  }

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
      setCardDialog(null)
      setCardFormError(null)
      setViewingCard(updatedCard)
    },
    onError: (error: unknown) => setCardFormError(errorMessageFrom(error)),
  })

  function closeColumnEditDialog() {
    setEditingColumn(null)
    setColumnFormError(null)
  }

  function closeCardDialog() {
    setCardDialog(null)
    setCardFormError(null)
  }

  return (
    <div className={styles.wrapper}>
      {isLoading ? <StatusMessage variant="loading" title="Carregando board…" /> : null}

      {isError ? <StatusMessage variant="error" title="Não foi possível carregar o board." /> : null}

      {!isLoading && !isError && board ? (
        <div className={styles.board} role="list" aria-label="Colunas do Kanban">
          {board.columns.map((column) => (
            <div role="listitem" key={column.id}>
              <BoardColumn
                column={column}
                cards={cardsByColumnId.get(column.id) ?? []}
                canManage={canEditColumns}
                onEdit={() => setEditingColumn(column)}
                canCreateCard={canEditCards && column.type === 'BACKLOG'}
                onCreateCard={() => setCardDialog({ mode: 'create' })}
                onCardClick={(card) => setViewingCard(card)}
              />
            </div>
          ))}
        </div>
      ) : null}

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
        open={viewingCard !== null}
        card={viewingCard}
        canManage={canEditCards}
        onEdit={() => {
          if (viewingCard) {
            setCardDialog({ mode: 'edit', card: viewingCard })
            setViewingCard(null)
          }
        }}
        onClose={() => setViewingCard(null)}
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
