import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { signupApi } from '@/features/signup/api/signupApi'
import type { AccountSetupValidation } from '@/features/signup/types'
import { ApiError } from '@/shared/api/apiError'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './AccountSetupPage.module.css'

const SESSION_STORAGE_KEY = 'ykanban.accountSetupToken'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

function readAndClearFragmentToken(): string | null {
  const hash = window.location.hash
  const match = /#token=(.+)$/.exec(hash)
  const capturedToken = match?.[1]
  if (!capturedToken) {
    return null
  }
  const token = decodeURIComponent(capturedToken)
  // Remove o token da barra de endereço imediatamente (ver item 133) — nunca persiste na URL.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

/**
 * Tela pública de criação/claim de acesso administrativo (ver ADR 0029/Prompt 30, PARTE Q-V) — o
 * token só vive no fragment da URL (nunca query string, ver item 132) e em `sessionStorage`
 * enquanto atravessa o login (nunca `localStorage`, ver item 134), sempre limpo após o uso.
 */
export function AccountSetupPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, completeInvitationRegistration, completeInvitationAcceptance } = useAuth()

  // Lido uma única vez, na inicialização lazy do state (nunca via efeito) — a leitura do
  // fragment/sessionStorage é síncrona, então não há motivo para um round-trip de render extra.
  const [token] = useState<string | null>(() => {
    const fromFragment = readAndClearFragmentToken()
    if (fromFragment) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, fromFragment)
      return fromFragment
    }
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  })
  // `undefined` = ainda consultando o backend; `null` = consulta falhou/token inválido.
  const [validation, setValidation] = useState<AccountSetupValidation | null | undefined>(undefined)
  const [accountExists, setAccountExists] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    signupApi
      .validateAccountSetup(token)
      .then(setValidation)
      .catch(() => setValidation(null))
  }, [token])

  const mode =
    !token || validation === null || validation?.valid === false
      ? 'invalid'
      : validation === undefined
        ? 'loading'
        : accountExists
          ? 'accountExists'
          : isAuthenticated
            ? 'acceptingExisting'
            : 'register'

  function finishAndGoToProjects() {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    navigate(ROUTES.projects, { replace: true })
  }

  function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !token) return
    if (password !== confirmPassword) {
      setFormError('As senhas não coincidem.')
      return
    }
    setFormError(null)
    setIsSubmitting(true)
    signupApi
      .registerAccountSetup({ token, name: name.trim(), password })
      .then((result) => completeInvitationRegistration(result))
      .then(finishAndGoToProjects)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.problem?.code === 'ACCOUNT_ALREADY_EXISTS_LOGIN_REQUIRED') {
          setAccountExists(true)
          setIsSubmitting(false)
          return
        }
        setFormError(errorMessageFrom(error))
        setIsSubmitting(false)
      })
  }

  function handleAcceptExisting() {
    if (!token) return
    setIsSubmitting(true)
    setFormError(null)
    signupApi
      .acceptAccountSetup(token)
      .then((result) => completeInvitationAcceptance(result))
      .then(finishAndGoToProjects)
      .catch((error: unknown) => {
        setFormError(errorMessageFrom(error))
        setIsSubmitting(false)
      })
  }

  if (mode === 'loading') {
    return (
      <div className={styles.page}>
        <StatusMessage variant="loading" title="Verificando link…" />
      </div>
    )
  }

  if (mode === 'invalid') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <StatusMessage
            variant="error"
            title="Este link de ativação não é mais válido."
            description="Você pode solicitar um novo link informando o e-mail usado na assinatura."
          />
          <button type="button" className={styles.secondaryButton} onClick={() => navigate(ROUTES.subscribe)}>
            Voltar para os planos
          </button>
        </div>
      </div>
    )
  }

  const orgName = validation?.organizationName ?? ''
  const maskedEmail = validation?.maskedEmail ?? ''

  if (mode === 'accountExists') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>{orgName} está pronta</p>
          <h1 className={styles.title}>Este e-mail já possui uma conta no YKanban.</h1>
          <p className={styles.description}>Entre na sua conta para assumir a administração desta empresa.</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => navigate(ROUTES.login, { state: { from: { pathname: ROUTES.accountSetup } } })}
          >
            Entrar e continuar
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'acceptingExisting') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>{orgName} está pronta</p>
          <h1 className={styles.title}>Assumir a administração desta empresa?</h1>
          <p className={styles.description}>
            Conectado como <strong>{user?.email}</strong>.
          </p>

          {formError ? (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          ) : null}

          <button type="button" className={styles.primaryButton} onClick={handleAcceptExisting} disabled={isSubmitting}>
            {isSubmitting ? 'Concluindo…' : 'Continuar'}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => void logout()}>
            Sair e entrar com outra conta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{orgName} está pronta</p>
        <h1 className={styles.title}>Crie seu acesso administrativo.</h1>

        {formError ? (
          <p className={styles.error} role="alert">
            {formError}
          </p>
        ) : null}

        <form className={styles.form} onSubmit={handleRegisterSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="setup-name">
              Nome
            </label>
            <input
              id="setup-name"
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="setup-email">
              E-mail
            </label>
            <input id="setup-email" className={styles.input} value={maskedEmail} readOnly disabled />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="setup-password">
              Senha
            </label>
            <input
              id="setup-password"
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
            <label className={styles.label} htmlFor="setup-confirm-password">
              Confirmar senha
            </label>
            <input
              id="setup-confirm-password"
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
            {isSubmitting ? 'Criando acesso…' : 'Criar meu acesso'}
          </button>
        </form>
      </div>
    </div>
  )
}
