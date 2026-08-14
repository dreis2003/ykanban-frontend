import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CARD_PRIORITY_OPTIONS, CARD_TYPE_OPTIONS } from '@/features/card/labels'
import type { Card, CardPriority, CardType } from '@/features/card/types'
import styles from './CardFormDialog.module.css'

interface Props {
  mode: 'create' | 'edit'
  open: boolean
  card?: Card | null
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (values: { title: string; description: string; type: CardType; priority: CardPriority }) => void
  onClose: () => void
}

const DEFAULT_TYPE: CardType = 'FEATURE'
const DEFAULT_PRIORITY: CardPriority = 'MEDIUM'

function validateTitle(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Título é obrigatório.'
  if (trimmed.length < 3) return 'Título deve ter no mínimo 3 caracteres.'
  if (trimmed.length > 200) return 'Título deve ter no máximo 200 caracteres.'
  return null
}

export function CardFormDialog({ mode, open, card, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CardType>(DEFAULT_TYPE)
  const [priority, setPriority] = useState<CardPriority>(DEFAULT_PRIORITY)
  const [titleError, setTitleError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setTitle(mode === 'edit' ? (card?.title ?? '') : '')
      setDescription(mode === 'edit' ? (card?.description ?? '') : '')
      setType(mode === 'edit' ? (card?.type ?? DEFAULT_TYPE) : DEFAULT_TYPE)
      setPriority(mode === 'edit' ? (card?.priority ?? DEFAULT_PRIORITY) : DEFAULT_PRIORITY)
      setTitleError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, mode, card])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitleError = validateTitle(title)
    setTitleError(nextTitleError)
    if (nextTitleError) {
      return
    }
    onSubmit({ title: title.trim(), description: description.trim(), type, priority })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.requestSubmit()
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <h2 className={styles.title}>{mode === 'create' ? 'Novo card' : 'Editar card'}</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="card-title">
            Título
          </label>
          <input
            id="card-title"
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            autoFocus
          />
          {titleError ? (
            <p className={styles.fieldError} role="alert">
              {titleError}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="card-description">
            Descrição
          </label>
          <textarea
            id="card-description"
            className={styles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSubmitting}
            rows={4}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="card-type">
              Tipo
            </label>
            <select
              id="card-type"
              className={styles.input}
              value={type}
              onChange={(event) => setType(event.target.value as CardType)}
              disabled={isSubmitting}
            >
              {CARD_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="card-priority">
              Prioridade
            </label>
            <select
              id="card-priority"
              className={styles.input}
              value={priority}
              onChange={(event) => setPriority(event.target.value as CardPriority)}
              disabled={isSubmitting}
            >
              {CARD_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
