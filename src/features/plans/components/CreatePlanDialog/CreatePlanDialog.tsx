import { useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './CreatePlanDialog.module.css'

interface Props {
  open: boolean
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (values: { name: string; code: string; description: string; displayOrder: number }) => void
  onClose: () => void
}

/**
 * Criação de Plan (ver ADR 0025) — nunca pede preço/moeda (Billing é escopo futuro) nem status: um
 * plano novo sempre nasce {@code INACTIVE}, ativado explicitamente depois de Features/Limits
 * configurados. `code` é imutável após a criação.
 */
export function CreatePlanDialog({ open, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [displayOrder, setDisplayOrder] = useState('0')
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setName('')
      setCode('')
      setDescription('')
      setDisplayOrder('0')
      setFieldError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedCode = code.trim()
    if (!trimmedName || !trimmedCode) {
      setFieldError('Nome e código são obrigatórios.')
      return
    }
    const parsedDisplayOrder = Number(displayOrder)
    if (!Number.isInteger(parsedDisplayOrder)) {
      setFieldError('Ordem de exibição deve ser um número inteiro.')
      return
    }
    setFieldError(null)
    onSubmit({ name: trimmedName, code: trimmedCode, description: description.trim(), displayOrder: parsedDisplayOrder })
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>Novo plano</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="plan-name">
            Nome do plano
          </label>
          <input
            id="plan-name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="plan-code">
            Código
          </label>
          <input
            id="plan-code"
            type="text"
            className={styles.input}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={isSubmitting}
          />
          <p className={styles.hint}>Identificador único e permanente do plano (ex.: PROFESSIONAL) — não pode ser alterado depois.</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="plan-description">
            Descrição
          </label>
          <textarea
            id="plan-description"
            className={styles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSubmitting}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="plan-display-order">
            Ordem de exibição
          </label>
          <input
            id="plan-display-order"
            type="number"
            className={styles.input}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {fieldError ? (
          <p className={styles.fieldError} role="alert">
            {fieldError}
          </p>
        ) : null}

        {errorMessage ? (
          <p className={styles.formError} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? 'Criando plano…' : 'Criar plano'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
