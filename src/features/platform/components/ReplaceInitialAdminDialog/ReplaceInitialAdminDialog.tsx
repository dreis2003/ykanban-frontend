import { useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './ReplaceInitialAdminDialog.module.css'

interface Props {
  open: boolean
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (email: string) => void
  onClose: () => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Troca do e-mail do administrador inicial ainda não aceito (ver ADR 0024, itens 68-71) — o
 * convite atual é revogado e um novo é enviado para o e-mail informado aqui. */
export function ReplaceInitialAdminDialog({ open, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setEmail('')
      setFieldError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setFieldError('E-mail é obrigatório.')
      return
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setFieldError('E-mail inválido.')
      return
    }
    setFieldError(null)
    onSubmit(trimmed)
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>Trocar administrador inicial</h2>
        <p className={styles.description}>O convite atual será invalidado e um novo convite será enviado.</p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="replace-admin-email">
            Novo e-mail do administrador
          </label>
          <input
            id="replace-admin-email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            autoFocus
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
            {isSubmitting ? 'Enviando…' : 'Trocar e enviar novo convite'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
