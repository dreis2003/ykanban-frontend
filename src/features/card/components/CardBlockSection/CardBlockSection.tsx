import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { cardBlockApi } from '@/features/card/api/cardBlockApi'
import type { Card, CardBlockInfo } from '@/features/card/types'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { ApiError } from '@/shared/api/apiError'
import { formatDateTime } from '@/shared/utils/formatDate'
import styles from './CardBlockSection.module.css'

interface Props {
  cardId: string
  cardKey: string
  projectId: string
  blocked: boolean
  block: CardBlockInfo | null
  canManage: boolean
}

const REASON_MIN_LENGTH = 5
const REASON_MAX_LENGTH = 1000

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/**
 * Sem optimistic update — blockedAt/blockedBy são gerados pelo backend (ver Prompt 13), então a UI
 * só reflete o Card depois da resposta autoritativa. Escreve o CardResponse completo devolvido por
 * block/unblock direto no cache ['card', cardId] e invalida ['cards', projectId] ao final, para o
 * indicador do KanbanCard no board não ficar desatualizado.
 */
export function CardBlockSection({ cardId, cardKey, projectId, blocked, block, canManage }: Props) {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmUnblockOpen, setConfirmUnblockOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function invalidateCardsList() {
    return queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
  }

  const blockMutation = useMutation({
    mutationFn: (blockReason: string) => cardBlockApi.block(cardId, blockReason),
    onSuccess: (updated: Card) => {
      queryClient.setQueryData(['card', cardId], updated)
      setError(null)
      setFormOpen(false)
      setReason('')
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
    onSettled: invalidateCardsList,
  })

  const unblockMutation = useMutation({
    mutationFn: () => cardBlockApi.unblock(cardId),
    onSuccess: (updated: Card) => {
      queryClient.setQueryData(['card', cardId], updated)
      setError(null)
      setConfirmUnblockOpen(false)
    },
    onError: (err: unknown) => {
      setError(errorMessageFrom(err))
      setConfirmUnblockOpen(false)
    },
    onSettled: invalidateCardsList,
  })

  function validateReason(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) {
      return 'Informe o motivo do bloqueio.'
    }
    if (trimmed.length < REASON_MIN_LENGTH || trimmed.length > REASON_MAX_LENGTH) {
      return `Motivo deve ter entre ${REASON_MIN_LENGTH} e ${REASON_MAX_LENGTH} caracteres.`
    }
    return null
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateReason(reason)
    if (validationError) {
      setError(validationError)
      return
    }
    blockMutation.mutate(reason.trim())
  }

  function closeForm() {
    setFormOpen(false)
    setReason('')
    setError(null)
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Status do bloqueio</h3>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {blocked && block ? (
        <div className={styles.blockedBanner}>
          <span className={styles.blockedHeading}>
            <AlertTriangle size={14} aria-hidden="true" />
            Card bloqueado
          </span>
          <p className={styles.reason}>{block.reason}</p>
          <span className={styles.meta}>
            Bloqueado por {block.blockedBy.name} em {formatDateTime(block.blockedAt)}
          </span>
          {canManage ? (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setConfirmUnblockOpen(true)}
            >
              Desbloquear
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span>Não bloqueado</span>
          {canManage && !formOpen ? (
            <button type="button" className={styles.actionButton} onClick={() => setFormOpen(true)}>
              Bloquear Card
            </button>
          ) : null}
        </div>
      )}

      {canManage && formOpen ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <textarea
            className={styles.textarea}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo do bloqueio…"
            aria-label="Motivo do bloqueio"
            autoFocus
          />
          <div className={styles.formActions}>
            <button type="submit" className={styles.save} disabled={blockMutation.isPending}>
              {blockMutation.isPending ? 'Bloqueando…' : 'Bloquear'}
            </button>
            <button type="button" className={styles.cancel} onClick={closeForm}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirmUnblockOpen}
        title="Desbloquear card"
        description={`Desbloquear ${cardKey}?`}
        confirmLabel="Desbloquear"
        isConfirming={unblockMutation.isPending}
        onConfirm={() => unblockMutation.mutate()}
        onCancel={() => setConfirmUnblockOpen(false)}
      />
    </section>
  )
}
