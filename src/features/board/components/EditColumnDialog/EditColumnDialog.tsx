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

const WIP_LIMIT_MAX = 999

function validateWipLimit(value: string): string | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > WIP_LIMIT_MAX) {
    return `Limite de WIP deve ser um número inteiro entre 1 e ${WIP_LIMIT_MAX}, ou vazio para sem limite.`
  }
  return null
}

export function EditColumnDialog({ open, column, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [wipLimit, setWipLimit] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [wipLimitError, setWipLimitError] = useState<string | null>(null)
  // Passo de confirmação quando a redução deixa a coluna acima do WIP (ver ADR 0017) — qualquer
  // edição no campo depois de armado invalida a confirmação pendente (reavaliada no próximo submit).
  const [pendingOverWipConfirmation, setPendingOverWipConfirmation] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setName(column?.name ?? '')
      setWipLimit(column?.wipLimit != null ? String(column.wipLimit) : '')
      setNameError(null)
      setWipLimitError(null)
      setPendingOverWipConfirmation(false)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, column])

  const currentCardCount = column?.cardCount ?? 0

  function handleWipLimitChange(value: string) {
    setWipLimit(value)
    setPendingOverWipConfirmation(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextNameError = validateName(name)
    const nextWipLimitError = validateWipLimit(wipLimit)
    setNameError(nextNameError)
    setWipLimitError(nextWipLimitError)
    if (nextNameError || nextWipLimitError) {
      return
    }
    const parsedWipLimit = wipLimit.trim() ? Number(wipLimit) : null

    if (!pendingOverWipConfirmation && parsedWipLimit != null && parsedWipLimit < currentCardCount) {
      setPendingOverWipConfirmation(true)
      return
    }

    onSubmit({ name: name.trim(), wipLimit: parsedWipLimit })
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
            max={WIP_LIMIT_MAX}
            step={1}
            value={wipLimit}
            onChange={(event) => handleWipLimitChange(event.target.value)}
            disabled={isSubmitting}
            placeholder="Sem limite"
          />
          <p className={styles.hint}>Número máximo de cards permitidos nesta coluna. Deixe em branco para sem limite.</p>
          {wipLimitError ? (
            <p className={styles.fieldError} role="alert">
              {wipLimitError}
            </p>
          ) : null}
        </div>

        {pendingOverWipConfirmation ? (
          <p className={styles.formWarning} role="alert">
            Esta coluna possui {currentCardCount} cards. Ao definir o limite como {wipLimit}, ela ficará acima do WIP
            permitido. Nenhum card será removido, mas novos cards não poderão entrar até que a quantidade seja
            reduzida.
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
            {isSubmitting ? 'Salvando…' : pendingOverWipConfirmation ? 'Confirmar mesmo assim' : 'Salvar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
