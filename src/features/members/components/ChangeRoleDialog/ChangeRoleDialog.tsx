import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { MembershipRole } from '@/features/auth/types'
import type { Member } from '@/features/members/types'
import styles from './ChangeRoleDialog.module.css'

interface Props {
  open: boolean
  member: Member | null
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (role: MembershipRole) => void
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

export function ChangeRoleDialog({ open, member, isSubmitting, errorMessage, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [role, setRole] = useState<MembershipRole>('VIEWER')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setRole(member?.role ?? 'VIEWER')
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, member])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(role)
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Alterar papel de {member?.name}</h2>

        <div className={styles.options} role="radiogroup" aria-label="Papel">
          {ROLE_OPTIONS.map((option) => (
            <label key={option.value} className={styles.option} data-selected={role === option.value}>
              <input
                type="radio"
                name="role"
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
