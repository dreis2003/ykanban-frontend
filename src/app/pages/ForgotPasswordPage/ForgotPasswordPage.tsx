import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { accountApi } from '@/features/account/api/accountApi'
import styles from './ForgotPasswordPage.module.css'

/**
 * "Esqueci minha senha" (ver ADR 0030/Prompt 31, PARTE G/H) — pública. A resposta é SEMPRE a
 * mesma mensagem genérica, exista ou não o e-mail/esteja ele ativo ou não (anti-enumeração,
 * item 56) — nunca revela nada sobre a existência da conta.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    accountApi
      .requestPasswordReset({ email: email.trim() })
      .catch(() => undefined)
      .finally(() => {
        setIsSubmitting(false)
        setSubmitted(true)
      })
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Verifique seu e-mail</h1>
          <p className={styles.description}>
            Se houver uma conta associada a este e-mail, enviamos um link para redefinir a senha.
          </p>
          <Link to={ROUTES.login} className={styles.secondaryButton}>
            Voltar para o login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Esqueci minha senha</h1>
        <p className={styles.description}>Informe o e-mail da sua conta para receber um link de redefinição.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="forgot-email">
              E-mail
            </label>
            <input
              id="forgot-email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Enviar link de redefinição'}
          </button>
        </form>

        <Link to={ROUTES.login} className={styles.backLink}>
          Voltar para o login
        </Link>
      </div>
    </div>
  )
}
