import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { MembershipRole } from '@/features/auth/types'
import styles from './InviteMemberDialog.module.css'

interface Props {
  open: boolean
  isSubmitting: boolean
  errorMessage: string | null
  /** Pré-preenche o formulário — usado ao reenviar um convite EXPIRED como um novo convite (ver
   * ADR 0022, item 111: nunca reaproveitar o token expirado, só os mesmos dados). */
  initialValues?: { email: string; role: MembershipRole } | null
  onSubmit: (values: { email: string; role: MembershipRole }) => void
  onClose: () => void
}

const ROLE_OPTIONS: { value: MembershipRole; label: string; description: string }[] = [
  {
    value: 'ADMIN',
    label: 'Administrador',
    description: 'Acesso total: gerencia membros, papéis e configurações da organização.',
  },
  {
    value: 'PROJECT_MANAGER',
    label: 'Gerente de Projetos',
    description: 'Gerencia projetos e cards, mas não administra membros da organização.',
  },
  {
    value: 'DEVELOPER',
    label: 'Desenvolvedor',
    description: 'Cria e atualiza cards nos projetos aos quais tem acesso.',
  },
  {
    value: 'VIEWER',
    label: 'Visualizador',
    description: 'Apenas visualiza projetos e cards, sem permissão de edição.',
  },
]

/** ADMIN nunca define nome ou senha de outra pessoa (ver ADR 0022, itens 104-105) — a pessoa
 * convidada informa isso ao criar a própria conta. */
export function InviteMemberDialog({ open, isSubmitting, errorMessage, initialValues, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MembershipRole>('VIEWER')
  const [emailError, setEmailError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setEmail(initialValues?.email ?? '')
      setRole(initialValues?.role ?? 'VIEWER')
      setEmailError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialValues])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setEmailError('E-mail é obrigatório.')
      return
    }
    setEmailError(null)
    onSubmit({ email: trimmed, role })
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>Convidar usuário</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="invite-email">
            E-mail
          </label>
          <input
            id="invite-email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            autoFocus
          />
          {emailError ? (
            <p className={styles.fieldError} role="alert">
              {emailError}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Função</span>
          <div className={styles.options} role="radiogroup" aria-label="Função">
            {ROLE_OPTIONS.map((option) => (
              <label key={option.value} className={styles.option} data-selected={role === option.value}>
                <input
                  type="radio"
                  name="invite-role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  disabled={isSubmitting}
                />
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>{option.label}</span>
                  <span className={styles.optionDescription}>{option.description}</span>
                </span>
              </label>
            ))}
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
            {isSubmitting ? 'Enviando…' : 'Enviar convite'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
