import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { KanbanColumn } from '@/features/board/types'
import styles from './EditColumnDialog.module.css'

interface Props {
  open: boolean
  column: KanbanColumn | null
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (values: { name: string; wipLimit: number | null }) => void
  onClose: () => void
}

function validateName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Nome é obrigatório.'
  if (trimmed.length > 100) return 'Nome deve ter no máximo 100 caracteres.'
  return null
}

function validateWipLimit(value: string): string | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 'Limite de WIP deve ser um número inteiro positivo, ou vazio para sem limite.'
  }
  return null
}

export function EditColumnDialog({ open, column, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [wipLimit, setWipLimit] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [wipLimitError, setWipLimitError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setName(column?.name ?? '')
      setWipLimit(column?.wipLimit != null ? String(column.wipLimit) : '')
      setNameError(null)
      setWipLimitError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, column])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextNameError = validateName(name)
    const nextWipLimitError = validateWipLimit(wipLimit)
    setNameError(nextNameError)
    setWipLimitError(nextWipLimitError)
    if (nextNameError || nextWipLimitError) {
      return
    }
    onSubmit({ name: name.trim(), wipLimit: wipLimit.trim() ? Number(wipLimit) : null })
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>Editar coluna</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="column-name">
            Nome
          </label>
          <input
            id="column-name"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            autoFocus
          />
          {nameError ? (
            <p className={styles.fieldError} role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="column-wip-limit">
            Limite WIP
          </label>
          <input
            id="column-wip-limit"
            className={styles.input}
            type="number"
            min={1}
            step={1}
            value={wipLimit}
            onChange={(event) => setWipLimit(event.target.value)}
            disabled={isSubmitting}
            placeholder="Sem limite"
          />
          <p className={styles.hint}>Deixe em branco para não limitar a quantidade de cards.</p>
          {wipLimitError ? (
            <p className={styles.fieldError} role="alert">
              {wipLimitError}
            </p>
          ) : null}
        </div>

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
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
