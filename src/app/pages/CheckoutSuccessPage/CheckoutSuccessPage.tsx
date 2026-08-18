import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { billingApi } from '@/features/billing/api/billingApi'
import styles from './CheckoutSuccessPage.module.css'

const MAX_POLL_ATTEMPTS = 10
const POLL_INTERVAL_MS = 3000

/**
 * Retorno do Stripe Checkout (ver ADR 0028, PARTE K) — o redirect NUNCA confirma o pagamento por
 * si só (item 89/94); esta página consulta {@code GET /billing/checkout-sessions/{id}} com um
 * retry curto e limitado (nunca polling agressivo infinito, item 91) até o webhook confirmar.
 */
export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams()
  const checkoutId = searchParams.get('checkoutId')
  const queryClient = useQueryClient()
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    if (!checkoutId) return undefined
    const timeout = setTimeout(() => setGaveUp(true), MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS)
    return () => clearTimeout(timeout)
  }, [checkoutId])

  const { data: status } = useQuery({
    queryKey: ['billing', 'checkout-sessions', checkoutId],
    queryFn: () => billingApi.checkoutSessionStatus(checkoutId as string),
    enabled: Boolean(checkoutId),
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' && !gaveUp ? POLL_INTERVAL_MS : false),
  })

  useEffect(() => {
    if (status?.status === 'COMPLETED') {
      queryClient.invalidateQueries({ queryKey: ['entitlements'] })
    }
  }, [status?.status, queryClient])

  const stillWaitingAfterAttempts = status?.status === 'PENDING' && gaveUp

  return (
    <section className={styles.page}>
      {!checkoutId ? (
        <>
          <h1 className={styles.title}>Sessão de checkout não encontrada.</h1>
          <Link to={ROUTES.subscription} className={styles.primaryButton}>
            Voltar para Assinatura
          </Link>
        </>
      ) : status?.status === 'COMPLETED' ? (
        <>
          <h1 className={styles.title}>Assinatura ativada com sucesso.</h1>
          <p className={styles.description}>Seu novo plano já está disponível.</p>
          <Link to={ROUTES.subscription} className={styles.primaryButton}>
            Ver assinatura
          </Link>
        </>
      ) : status?.status === 'EXPIRED' || status?.status === 'CANCELED' ? (
        <>
          <h1 className={styles.title}>O checkout não foi concluído.</h1>
          <p className={styles.description}>Nenhuma cobrança foi feita. Você pode tentar novamente quando quiser.</p>
          <Link to={ROUTES.subscription} className={styles.primaryButton}>
            Voltar para Assinatura
          </Link>
        </>
      ) : stillWaitingAfterAttempts ? (
        <>
          <h1 className={styles.title}>Pagamento recebido.</h1>
          <p className={styles.description}>
            A confirmação da assinatura ainda está sendo processada. Isso pode levar alguns instantes.
          </p>
          <Link to={ROUTES.subscription} className={styles.primaryButton}>
            Ver assinatura
          </Link>
        </>
      ) : (
        <>
          <h1 className={styles.title}>Estamos confirmando sua assinatura…</h1>
          <p className={styles.description}>Não feche esta página.</p>
        </>
      )}
    </section>
  )
}
