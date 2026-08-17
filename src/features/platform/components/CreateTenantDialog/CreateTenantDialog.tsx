import { useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './CreateTenantDialog.module.css'

interface Props {
  open: boolean
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (values: { name: string; slug: string; adminEmail: string }) => void
  onClose: () => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Slug é imutável após a criação (ver ADR 0023) — este formulário é o único lugar onde ele é
 * definido; sugerido automaticamente a partir do nome, mas sempre editável antes de enviar.
 *
 * <p>Provisionamento completo (ver ADR 0024): nunca pede Role (primeiro administrador é sempre
 * ADMIN) nem senha (quem aceita o convite define a própria conta).
 */
export function CreateTenantDialog({ open, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setName('')
      setSlug('')
      setSlugTouched(false)
      setAdminEmail('')
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
    const trimmedEmail = adminEmail.trim()
    if (!trimmedName || !trimmedSlug || !trimmedEmail) {
      setFieldError('Nome, slug e e-mail do administrador são obrigatórios.')
      return
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setFieldError('E-mail do administrador inválido.')
      return
    }
    setFieldError(null)
    onSubmit({ name: trimmedName, slug: trimmedSlug, adminEmail: trimmedEmail })
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>Nova empresa</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tenant-name">
            Nome da empresa
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

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tenant-admin-email">
            E-mail do administrador
          </label>
          <input
            id="tenant-admin-email"
            type="email"
            className={styles.input}
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            disabled={isSubmitting}
          />
          <p className={styles.hint}>
            O administrador receberá um convite para criar ou acessar sua conta e assumir a administração da empresa.
          </p>
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
            {isSubmitting ? 'Criando empresa…' : 'Criar empresa e enviar convite'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
