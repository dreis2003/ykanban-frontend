import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { accountApi } from '@/features/account/api/accountApi'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ConfirmEmailChangePage.module.css'

function readAndClearFragmentToken(): string | null {
  const hash = window.location.hash
  const match = /#token=(.+)$/.exec(hash)
  const capturedToken = match?.[1]
  if (!capturedToken) {
    return null
  }
  const token = decodeURIComponent(capturedToken)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

type Status = 'loading' | 'success' | 'error'

/**
 * Confirmação pública de troca de e-mail (ver ADR 0030/Prompt 31, PARTE N) — o token já comprova
 * posse do novo endereço, nunca exige sessão. A sessão atual (se houver) é invalidada pelo backend
 * via `securityVersion`, então esta tela nunca assume que o usuário continua autenticado depois.
 */
export function ConfirmEmailChangePage() {
  const [token] = useState<string | null>(() => readAndClearFragmentToken())
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error')

  useEffect(() => {
    if (!token) return
    accountApi
      .confirmEmailChange({ token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <StatusMessage variant="loading" title="Confirmando seu novo e-mail…" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <StatusMessage
            variant="error"
            title="Este link de confirmação não é mais válido."
            description="Solicite uma nova troca de e-mail em Minha Conta e tente novamente."
          />
          <Link to={ROUTES.login} className={styles.secondaryButton}>
            Ir para o login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <StatusMessage
          variant="empty"
          title="E-mail confirmado com sucesso."
          description="Sua conta agora usa o novo endereço. Entre novamente para continuar."
        />
        <Link to={ROUTES.login} className={styles.primaryButton}>
          Ir para o login
        </Link>
      </div>
    </div>
  )
}
