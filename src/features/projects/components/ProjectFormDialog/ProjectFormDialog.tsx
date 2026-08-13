import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Project } from '@/features/projects/types'
import styles from './ProjectFormDialog.module.css'

interface Props {
  mode: 'create' | 'edit'
  open: boolean
  project?: Project | null
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (values: { code?: string; name: string; description: string }) => void
  onClose: () => void
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{2,20}$/

function validateCode(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Código é obrigatório.'
  if (!CODE_PATTERN.test(trimmed)) {
    return "Código deve ter de 2 a 20 caracteres — apenas letras, números, '-' ou '_'."
  }
  return null
}

function validateName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Nome é obrigatório.'
  if (trimmed.length > 150) return 'Nome deve ter no máximo 150 caracteres.'
  return null
}

export function ProjectFormDialog({ mode, open, project, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setCode(mode === 'edit' ? (project?.code ?? '') : '')
      setName(mode === 'edit' ? (project?.name ?? '') : '')
      setDescription(mode === 'edit' ? (project?.description ?? '') : '')
      setCodeError(null)
      setNameError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, mode, project])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextCodeError = mode === 'create' ? validateCode(code) : null
    const nextNameError = validateName(name)
    setCodeError(nextCodeError)
    setNameError(nextNameError)
    if (nextCodeError || nextNameError) {
      return
    }
    onSubmit(
      mode === 'create'
        ? { code: code.trim(), name: name.trim(), description: description.trim() }
        : { name: name.trim(), description: description.trim() },
    )
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>{mode === 'create' ? 'Novo projeto' : 'Editar projeto'}</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="project-code">
            Código
          </label>
          {mode === 'create' ? (
            <>
              <input
                id="project-code"
                className={styles.input}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
              <p className={styles.hint}>Código não poderá ser alterado posteriormente.</p>
            </>
          ) : (
            <input id="project-code" className={styles.input} value={code} readOnly disabled />
          )}
          {codeError ? (
            <p className={styles.fieldError} role="alert">
              {codeError}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="project-name">
            Nome
          </label>
          <input
            id="project-name"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
          />
          {nameError ? (
            <p className={styles.fieldError} role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="project-description">
            Descrição
          </label>
          <textarea
            id="project-description"
            className={styles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSubmitting}
            rows={4}
          />
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
