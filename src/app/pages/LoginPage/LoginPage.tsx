import { useCallback, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { ApiError } from '@/shared/api/apiError'
import styles from './LoginPage.module.css'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (isSubmitting) {
        return
      }

      setIsSubmitting(true)
      setError(null)

      login(email, password).catch((err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.',
        )
        setIsSubmitting(false)
      })
    },
    [email, password, isSubmitting, login],
  )

  if (isAuthenticated) {
    const state = location.state as LocationState | null
    return <Navigate to={state?.from?.pathname ?? ROUTES.home} replace />
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            Y
          </span>
          <div>
            <p className={styles.brandName}>YKanban</p>
            <p className={styles.brandSub}>Yakuza Studio</p>
          </div>
        </div>

        <h1 className={styles.title}>Entrar</h1>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              className={styles.input}
            />
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <Link to={ROUTES.forgotPassword} className={styles.forgotPasswordLink}>
          Esqueci minha senha
        </Link>
      </div>
    </div>
  )
}
