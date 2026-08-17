import { useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './CreateTenantDialog.module.css'

interface Props {
  open: boolean
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (values: { name: string; slug: string }) => void
  onClose: () => void
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Slug é imutável após a criação (ver ADR 0023) — este formulário é o único lugar onde ele é
 * definido; sugerido automaticamente a partir do nome, mas sempre editável antes de enviar. */
export function CreateTenantDialog({ open, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setName('')
      setSlug('')
      setSlugTouched(false)
      setFieldError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) {
      setSlug(slugify(value))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    if (!trimmedName || !trimmedSlug) {
      setFieldError('Nome e slug são obrigatórios.')
      return
    }
    setFieldError(null)
    onSubmit({ name: trimmedName, slug: trimmedSlug })
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>Nova organização</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tenant-name">
            Nome
          </label>
          <input
            id="tenant-name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tenant-slug">
            Slug
          </label>
          <input
            id="tenant-slug"
            type="text"
            className={styles.input}
            value={slug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(event.target.value)
            }}
            disabled={isSubmitting}
          />
          <p className={styles.hint}>Identificador único e permanente da organização — não pode ser alterado depois.</p>
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
            {isSubmitting ? 'Criando…' : 'Criar organização'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
