import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import type { MembershipRole } from '@/features/auth/types'
import { invitationsApi } from '@/features/invitations/api/invitationsApi'
import type { PublicInvitation } from '@/features/invitations/types'
import { ApiError } from '@/shared/api/apiError'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './AcceptInvitationPage.module.css'

const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Administrador',
  PROJECT_MANAGER: 'Gerente de Projetos',
  DEVELOPER: 'Desenvolvedor',
  VIEWER: 'Visualizador',
}

type Mode = 'choice' | 'register'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/**
 * Tela pública de convite (ver ADR 0022) — funciona sem autenticação. Token nunca vai para
 * localStorage/sessionStorage: vive só como parâmetro de rota, lido uma vez via `useParams`.
 */
export function AcceptInvitationPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, completeInvitationRegistration, completeInvitationAcceptance } = useAuth()

  const [invitation, setInvitation] = useState<PublicInvitation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('choice')

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    invitationsApi
      .getPublicByToken(token)
      .then((result) => {
        if (!cancelled) {
          setInvitation(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInvitation({ valid: false, status: null, organization: null, email: null, role: null, expiresAt: null })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    if (password !== confirmPassword) {
      setFormError('As senhas não coincidem.')
      return
    }
    setFormError(null)
    setIsSubmitting(true)
    invitationsApi
      .registerViaInvitation(token, { name: name.trim(), password })
      .then((result) => completeInvitationRegistration(result))
      .then(() => navigate(ROUTES.projects, { replace: true }))
      .catch((error: unknown) => {
        setFormError(errorMessageFrom(error))
        setIsSubmitting(false)
      })
  }

  function handleAccept() {
    setIsSubmitting(true)
    setFormError(null)
    invitationsApi
      .accept(token)
      .then((result) => completeInvitationAcceptance(result))
      .then(() => navigate(ROUTES.projects, { replace: true }))
      .catch((error: unknown) => {
        setFormError(errorMessageFrom(error))
        setIsSubmitting(false)
      })
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <StatusMessage variant="loading" title="Verificando convite…" />
      </div>
    )
  }

  if (!invitation || !invitation.valid) {
    const status = invitation?.status
    const title =
      status === 'EXPIRED'
        ? 'Este convite expirou.'
        : status === 'REVOKED'
          ? 'Este convite não está mais disponível.'
          : status === 'ACCEPTED'
            ? 'Este convite já foi utilizado.'
            : 'Este convite não é mais válido.'
    const description =
      status === 'EXPIRED'
        ? 'Peça a um administrador da organização para enviar um novo convite.'
        : status === 'ACCEPTED' && isAuthenticated
          ? undefined
          : 'Verifique se o link está correto ou peça um novo convite ao administrador da organização.'

    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <StatusMessage
            variant="error"
            title={title}
            {...(description ? { description } : {})}
            action={
              status === 'ACCEPTED' && isAuthenticated ? (
                <button type="button" className={styles.primaryButton} onClick={() => navigate(ROUTES.projects)}>
                  Ir para o YKanban
                </button>
              ) : undefined
            }
          />
        </div>
      </div>
    )
  }

  const roleLabel = invitation.role ? ROLE_LABELS[invitation.role] : ''
  const expiresAtLabel = invitation.expiresAt
    ? new Date(invitation.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : ''
  const emailMatches = isAuthenticated && user && invitation.email ? user.email.toLowerCase() === invitation.email : false

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Você foi convidado para</p>
        <h1 className={styles.orgName}>{invitation.organization?.name}</h1>
        <dl className={styles.details}>
          <div>
            <dt>Função</dt>
            <dd>{roleLabel}</dd>
          </div>
          <div>
            <dt>Convite válido até</dt>
            <dd>{expiresAtLabel}</dd>
          </div>
        </dl>

        {formError ? (
          <p className={styles.error} role="alert">
            {formError}
          </p>
        ) : null}

        {isAuthenticated ? (
          emailMatches ? (
            <button type="button" className={styles.primaryButton} onClick={handleAccept} disabled={isSubmitting}>
              {isSubmitting ? 'Aceitando…' : 'Aceitar convite'}
            </button>
          ) : (
            <div className={styles.mismatch}>
              <p>
                Este convite foi enviado para <strong>{invitation.email}</strong>, mas você está conectado com outra
                conta.
              </p>
              <button type="button" className={styles.secondaryButton} onClick={() => void logout()}>
                Sair e entrar com outra conta
              </button>
            </div>
          )
        ) : mode === 'choice' ? (
          <div className={styles.choiceActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate(ROUTES.login, { state: { from: { pathname: `/invitations/${token}` } } })}
            >
              Já tenho uma conta
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => setMode('register')}>
              Criar minha conta
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleRegisterSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="accept-name">
                Nome
              </label>
              <input
                id="accept-name"
                className={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSubmitting}
                required
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="accept-email">
                E-mail
              </label>
              <input id="accept-email" className={styles.input} value={invitation.email ?? ''} readOnly disabled />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="accept-password">
                Senha
              </label>
              <input
                id="accept-password"
                type="password"
                className={styles.input}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="accept-confirm-password">
                Confirmar senha
              </label>
              <input
                id="accept-confirm-password"
                type="password"
                className={styles.input}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
              {isSubmitting ? 'Criando conta…' : 'Criar conta e aceitar convite'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
