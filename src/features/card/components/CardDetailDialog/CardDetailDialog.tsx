import { useEffect, useRef } from 'react'
import { Pencil } from 'lucide-react'
import { CARD_PRIORITY_LABELS, CARD_TYPE_LABELS } from '@/features/card/labels'
import { formatDate } from '@/shared/utils/formatDate'
import type { Card } from '@/features/card/types'
import styles from './CardDetailDialog.module.css'

interface Props {
  open: boolean
  card: Card | null
  canManage: boolean
  onEdit: () => void
  onClose: () => void
}

export function CardDetailDialog({ open, card, canManage, onEdit, onClose }: Props) {
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
      {card ? (
        <div className={styles.content}>
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
              <dt>Coluna</dt>
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

          <div className={styles.actions}>
            <button type="button" className={styles.close} onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
