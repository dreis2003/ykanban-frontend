import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { signupApi } from '@/features/signup/api/signupApi'
import styles from './SubscriptionSuccessPage.module.css'

const MAX_POLL_ATTEMPTS = 20
const POLL_INTERVAL_MS = 3000

/**
 * Retorno do Stripe Checkout no fluxo público (ver ADR 0029/Prompt 30, PARTE AA) — o redirect do
 * browser NUNCA confirma o pagamento por si só (item 186/309); esta página só reflete o estado já
 * persistido pelo webhook, com polling curto e limitado (nunca infinito).
 */
export function SubscriptionSuccessPage() {
  const [searchParams] = useSearchParams()
  const signupId = searchParams.get('signupId')
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    if (!signupId) return undefined
    const timeout = setTimeout(() => setGaveUp(true), MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS)
    return () => clearTimeout(timeout)
  }, [signupId])

  const { data: status } = useQuery({
    queryKey: ['public', 'subscription-signups', signupId, 'status'],
    queryFn: () => signupApi.signupStatus(signupId as string),
    enabled: Boolean(signupId),
    refetchInterval: (query) => {
      const current = query.state.data?.status
      const stillWaiting = current === 'NOT_PAID' || current === 'PROCESSING'
      return stillWaiting && !gaveUp ? POLL_INTERVAL_MS : false
    },
  })

  if (!signupId) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Assinatura não encontrada.</h1>
        <Link to={ROUTES.subscribe} className={styles.primaryButton}>
          Voltar para os planos
        </Link>
      </section>
    )
  }

  if (status?.status === 'COMPLETED') {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Sua empresa está pronta.</h1>
        <p className={styles.description}>O cadastro administrativo já foi concluído.</p>
        <Link to={ROUTES.login} className={styles.primaryButton}>
          Entrar
        </Link>
      </section>
    )
  }

  if (status?.status === 'ACCOUNT_SETUP_EMAIL_SENT') {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Sua empresa foi criada.</h1>
        <p className={styles.description}>
          Enviamos para <strong>{status.maskedContactEmail}</strong> um link para criar seu acesso administrativo.
          Verifique sua caixa de entrada.
        </p>
        <Link to={ROUTES.accountSetup} className={styles.primaryButton}>
          Já tenho o link
        </Link>
      </section>
    )
  }

  if (status?.status === 'FAILED') {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Estamos com uma dificuldade técnica.</h1>
        <p className={styles.description}>
          Seu pagamento foi recebido, mas houve um problema ao preparar sua empresa. Nossa equipe já foi avisada e
          está tentando novamente automaticamente.
        </p>
      </section>
    )
  }

  if (status?.status === 'NOT_PAID' && gaveUp) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Ainda não identificamos o pagamento.</h1>
        <p className={styles.description}>Se você concluiu o pagamento, aguarde alguns instantes e atualize a página.</p>
        <Link to={ROUTES.subscribe} className={styles.primaryButton}>
          Voltar para os planos
        </Link>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Pagamento recebido.</h1>
      <p className={styles.description}>Estamos preparando sua empresa. Isso normalmente leva poucos instantes.</p>
    </section>
  )
}
