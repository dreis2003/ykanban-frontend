import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import type { AssignablePlan } from '@/features/plans/types'
import styles from './CreateTenantDialog.module.css'

interface Props {
  open: boolean
  isSubmitting: boolean
  errorMessage: string | null
  plans: AssignablePlan[]
  isLoadingPlans: boolean
  onSubmit: (values: { name: string; slug: string; adminEmail: string; planId: string }) => void
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
export function CreateTenantDialog({ open, isSubmitting, errorMessage, plans, isLoadingPlans, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [planId, setPlanId] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setName('')
      setSlug('')
      setSlugTouched(false)
      setAdminEmail('')
      setPlanId('')
      setFieldError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Derivado no render (nunca em efeito, ver react-hooks/set-state-in-effect): assim que a lista
  // carrega, o primeiro plano comercial disponível já aparece pré-selecionado sem round-trip extra
  // de render — `planId` só passa a mandar depois que o usuário escolhe algo explicitamente.
  const selectedPlanId = planId || plans[0]?.id || ''

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
    if (!trimmedName || !trimmedSlug || !trimmedEmail || !selectedPlanId) {
      setFieldError('Nome, slug, e-mail do administrador e plano são obrigatórios.')
      return
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setFieldError('E-mail do administrador inválido.')
      return
    }
    setFieldError(null)
    onSubmit({ name: trimmedName, slug: trimmedSlug, adminEmail: trimmedEmail, planId: selectedPlanId })
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

        <div className={styles.field}>
          <label className={styles.label} htmlFor="tenant-plan">
            Plano
          </label>
          {!isLoadingPlans && plans.length === 0 ? (
            <p className={styles.hint} role="alert">
              Cadastre e ative pelo menos um plano antes de criar uma empresa.{' '}
              <Link to={ROUTES.platformPlans}>Ir para Planos</Link>
            </p>
          ) : (
            <select
              id="tenant-plan"
              className={styles.input}
              value={selectedPlanId}
              onChange={(event) => setPlanId(event.target.value)}
              disabled={isSubmitting || isLoadingPlans}
            >
              {isLoadingPlans ? <option value="">Carregando planos…</option> : null}
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          )}
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
          <button type="submit" className={styles.submit} disabled={isSubmitting || plans.length === 0}>
            {isSubmitting ? 'Criando empresa…' : 'Criar empresa e enviar convite'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
