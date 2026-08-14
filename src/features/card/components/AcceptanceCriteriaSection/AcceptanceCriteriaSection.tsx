import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { acceptanceCriteriaApi } from '@/features/card/api/acceptanceCriteriaApi'
import type { AcceptanceCriterion, Card } from '@/features/card/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { SortableAcceptanceCriterionRow } from './SortableAcceptanceCriterionRow'
import styles from './AcceptanceCriteriaSection.module.css'

interface Props {
  cardId: string
  projectId: string
  criteria: AcceptanceCriterion[]
  canManage: boolean
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/**
 * As mutações aplicam optimistic update/rollback direto no cache ['card', cardId] (a única fonte
 * de estado deste drawer). Mas o resumo "3/5" no KanbanCard do board vem de um cache SEPARADO
 * (['cards', projectId], a listagem paginada) — por isso toda mutação também invalida essa query
 * ao final, senão o board continuaria mostrando o progresso antigo até um refetch por outro
 * motivo (ex.: reabrir a página).
 */
export function AcceptanceCriteriaSection({ cardId, projectId, criteria, canManage }: Props) {
  const queryClient = useQueryClient()
  const [newDescription, setNewDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<AcceptanceCriterion | null>(null)

  const ordered = [...criteria].sort((a, b) => a.position - b.position)
  const total = ordered.length
  const completedCount = ordered.filter((criterion) => criterion.completed).length

  const queryKey = ['card', cardId] as const

  function patchCard(updater: (card: Card) => Card) {
    queryClient.setQueryData<Card>(queryKey, (current) => (current ? updater(current) : current))
  }

  function invalidateCardsList() {
    return queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
  }

  const createMutation = useMutation({
    mutationFn: (description: string) => acceptanceCriteriaApi.create(cardId, { description }),
    onSuccess: (created) => {
      patchCard((card) => ({ ...card, acceptanceCriteria: [...card.acceptanceCriteria, created] }))
      setNewDescription('')
      setError(null)
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
    onSettled: invalidateCardsList,
  })

  const updateMutation = useMutation({
    mutationFn: ({ criterionId, description }: { criterionId: string; description: string }) =>
      acceptanceCriteriaApi.update(cardId, criterionId, { description }),
    onSuccess: (updated) => {
      patchCard((card) => ({
        ...card,
        acceptanceCriteria: card.acceptanceCriteria.map((criterion) => (criterion.id === updated.id ? updated : criterion)),
      }))
      setError(null)
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
    onSettled: invalidateCardsList,
  })

  const toggleMutation = useMutation({
    mutationFn: (criterion: AcceptanceCriterion) =>
      criterion.completed
        ? acceptanceCriteriaApi.reopen(cardId, criterion.id)
        : acceptanceCriteriaApi.complete(cardId, criterion.id),
    onMutate: (criterion) => {
      const previous = queryClient.getQueryData<Card>(queryKey)
      patchCard((card) => ({
        ...card,
        acceptanceCriteria: card.acceptanceCriteria.map((c) => (c.id === criterion.id ? { ...c, completed: !c.completed } : c)),
      }))
      setError(null)
      return { previous }
    },
    onError: (err: unknown, _criterion, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      setError(errorMessageFrom(err))
    },
    onSettled: invalidateCardsList,
  })

  const deleteMutation = useMutation({
    mutationFn: (criterionId: string) => acceptanceCriteriaApi.remove(cardId, criterionId),
    onSuccess: (_data, criterionId) => {
      patchCard((card) => {
        const remaining = card.acceptanceCriteria
          .filter((criterion) => criterion.id !== criterionId)
          .sort((a, b) => a.position - b.position)
          .map((criterion, index) => ({ ...criterion, position: index + 1 }))
        return { ...card, acceptanceCriteria: remaining }
      })
      setPendingDeletion(null)
      setError(null)
    },
    onError: (err: unknown) => {
      setError(errorMessageFrom(err))
      setPendingDeletion(null)
    },
    onSettled: invalidateCardsList,
  })

  const moveMutation = useMutation({
    mutationFn: ({ criterionId, targetPosition }: { criterionId: string; targetPosition: number }) =>
      acceptanceCriteriaApi.move(cardId, criterionId, { targetPosition }),
    onMutate: ({ criterionId, targetPosition }) => {
      const previous = queryClient.getQueryData<Card>(queryKey)
      patchCard((card) => {
        const list = [...card.acceptanceCriteria].sort((a, b) => a.position - b.position)
        const fromIndex = list.findIndex((criterion) => criterion.id === criterionId)
        if (fromIndex === -1) {
          return card
        }
        const reordered = arrayMove(list, fromIndex, targetPosition - 1)
        return { ...card, acceptanceCriteria: reordered.map((criterion, index) => ({ ...criterion, position: index + 1 })) }
      })
      setError(null)
      return { previous }
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      setError(errorMessageFrom(err))
    },
    onSettled: invalidateCardsList,
  })

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    const newIndex = ordered.findIndex((criterion) => criterion.id === over.id)
    if (newIndex === -1) {
      return
    }
    moveMutation.mutate({ criterionId: String(active.id), targetPosition: newIndex + 1 })
  }

  function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = newDescription.trim()
    if (!trimmed) {
      return
    }
    createMutation.mutate(trimmed)
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.title}>Critérios de Aceite</h3>
        {total > 0 ? (
          <span className={styles.progress} data-complete={completedCount === total}>
            {completedCount}/{total}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {total === 0 ? (
        <p className={styles.emptyState}>Nenhum critério de aceite definido.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map((criterion) => criterion.id)} strategy={verticalListSortingStrategy}>
            <ul className={styles.list} aria-label="Critérios de aceite">
              {ordered.map((criterion) => (
                <SortableAcceptanceCriterionRow
                  key={criterion.id}
                  criterion={criterion}
                  canManage={canManage}
                  onToggle={() => toggleMutation.mutate(criterion)}
                  onUpdateDescription={(description) => updateMutation.mutate({ criterionId: criterion.id, description })}
                  onDelete={() => setPendingDeletion(criterion)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {canManage ? (
        <form className={styles.addForm} onSubmit={handleAddSubmit}>
          <input
            className={styles.addInput}
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="Descreva o critério de aceite…"
            disabled={createMutation.isPending}
            aria-label="Descrição do novo critério de aceite"
          />
          <button type="submit" className={styles.addButton} disabled={createMutation.isPending || !newDescription.trim()}>
            <Plus size={14} aria-hidden="true" />
            Adicionar
          </button>
        </form>
      ) : null}

      <ConfirmDialog
        open={pendingDeletion !== null}
        title="Remover critério de aceite"
        description={pendingDeletion ? `Remover "${pendingDeletion.description}"? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Remover"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => pendingDeletion && deleteMutation.mutate(pendingDeletion.id)}
        onCancel={() => setPendingDeletion(null)}
      />
    </section>
  )
}
