import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { accountApi } from '@/features/account/api/accountApi'
import type { ValidatePasswordResetResponse } from '@/features/account/types'
import { ApiError } from '@/shared/api/apiError'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ResetPasswordPage.module.css'

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
  // O token nunca fica na barra de endereço — mesmo padrão de AccountSetupPage (ver item 133).
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

/**
 * Confirmação de "esqueci minha senha" (ver ADR 0030/Prompt 31, PARTE H/J) — pública, token só no
 * fragment da URL (nunca query string). Diferente de AccountSetupPage, não há sessionStorage:
 * este link é single-use e não precisa atravessar um redirect de login.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()

  const [token] = useState<string | null>(() => readAndClearFragmentToken())
  // `undefined` = ainda consultando o backend; `null` = consulta falhou/token inválido.
  const [validation, setValidation] = useState<ValidatePasswordResetResponse | null | undefined>(undefined)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!token) return
    accountApi
      .validatePasswordReset(token)
      .then(setValidation)
      .catch(() => setValidation(null))
  }, [token])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !token) return
    if (newPassword !== confirmPassword) {
      setFormError('As senhas não coincidem.')
      return
    }
    setFormError(null)
    setIsSubmitting(true)
    accountApi
      .confirmPasswordReset({ token, newPassword })
      .then(() => setCompleted(true))
      .catch((error: unknown) => {
        setFormError(errorMessageFrom(error))
        setIsSubmitting(false)
      })
  }

  if (completed) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <StatusMessage
            variant="empty"
            title="Senha redefinida com sucesso."
            description="Você já pode entrar com a sua nova senha."
          />
          <button type="button" className={styles.primaryButton} onClick={() => navigate(ROUTES.login)}>
            Ir para o login
          </button>
        </div>
      </div>
    )
  }

  if (!token || validation === null || validation?.valid === false) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <StatusMessage
            variant="error"
            title="Este link de redefinição de senha não é mais válido."
            description="Você pode solicitar um novo link a partir da tela de login."
          />
          <Link to={ROUTES.forgotPassword} className={styles.secondaryButton}>
            Solicitar novo link
          </Link>
        </div>
      </div>
    )
  }

  if (validation === undefined) {
    return (
      <div className={styles.page}>
        <StatusMessage variant="loading" title="Verificando link…" />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Defina sua nova senha</h1>

        {formError ? (
          <p className={styles.error} role="alert">
            {formError}
          </p>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reset-new-password">
              Nova senha
            </label>
            <input
              id="reset-new-password"
              type="password"
              className={styles.input}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reset-confirm-password">
              Confirmar nova senha
            </label>
            <input
              id="reset-confirm-password"
              type="password"
              className={styles.input}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              disabled={isSubmitting}
            />
          </div>
          <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Redefinir senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
