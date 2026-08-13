import { useEffect, useRef } from 'react'
import styles from './ConfirmDialog.module.css'

interface Props {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  isConfirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Modal de confirmação genérico via <dialog> nativo — foco/ESC/backdrop de graça, sem lib extra. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  isConfirming = false,
  onConfirm,
  onCancel,
}: Props) {
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
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onCancel}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel} disabled={isConfirming}>
          {cancelLabel}
        </button>
        <button type="button" className={styles.confirm} onClick={onConfirm} disabled={isConfirming}>
          {isConfirming ? 'Aguarde…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
