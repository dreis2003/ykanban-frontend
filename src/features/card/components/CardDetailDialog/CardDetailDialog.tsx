import { useEffect, useRef } from 'react'
import { Pencil } from 'lucide-react'
import { AcceptanceCriteriaSection } from '@/features/card/components/AcceptanceCriteriaSection/AcceptanceCriteriaSection'
import { CARD_PRIORITY_LABELS, CARD_TYPE_LABELS } from '@/features/card/labels'
import { formatDate } from '@/shared/utils/formatDate'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import type { Card } from '@/features/card/types'
import styles from './CardDetailDialog.module.css'

interface Props {
  open: boolean
  card: Card | null
  isLoading?: boolean
  isError?: boolean
  canManage: boolean
  onEdit: () => void
  onClose: () => void
}

/**
 * Drawer lateral (mesmo <dialog> nativo usado em todo o app, só com CSS ancorando à direita em
 * tela cheia) — mantém contexto visual do Board atrás dele, ao contrário de um modal centrado.
 * Aberto/fechado é sincronizado com a URL pelo ProjectBoard (ver rota
 * /projects/:projectId/cards/:cardId), então também funciona por link direto/reload.
 */
export function CardDetailDialog({ open, card, isLoading, isError, canManage, onEdit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <div className={styles.content}>
        {isLoading ? <StatusMessage variant="loading" title="Carregando card…" /> : null}
        {isError ? <StatusMessage variant="error" title="Não foi possível carregar o card." /> : null}

        {!isLoading && !isError && card ? (
          <>
            <div className={styles.header}>
              <span className={styles.key}>{card.key}</span>
              {canManage ? (
                <button type="button" className={styles.editButton} onClick={onEdit}>
                  <Pencil size={14} aria-hidden="true" />
                  Editar
                </button>
              ) : null}
            </div>

            <h2 className={styles.title}>{card.title}</h2>

            {card.description ? <p className={styles.description}>{card.description}</p> : null}

            <dl className={styles.meta}>
              <div>
                <dt>Tipo</dt>
                <dd>{CARD_TYPE_LABELS[card.type]}</dd>
              </div>
              <div>
                <dt>Prioridade</dt>
                <dd>{CARD_PRIORITY_LABELS[card.priority]}</dd>
              </div>
              <div>
                <dt>Status atual</dt>
                <dd>{card.column.name}</dd>
              </div>
              <div>
                <dt>Criado em</dt>
                <dd>{formatDate(card.createdAt)}</dd>
              </div>
              <div>
                <dt>Atualizado em</dt>
                <dd>{formatDate(card.updatedAt)}</dd>
              </div>
            </dl>

            <AcceptanceCriteriaSection
              cardId={card.id}
              projectId={card.projectId}
              criteria={card.acceptanceCriteria}
              canManage={canManage}
            />
          </>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className={styles.close} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  )
}
