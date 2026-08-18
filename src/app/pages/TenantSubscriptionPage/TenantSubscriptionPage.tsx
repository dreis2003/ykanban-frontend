import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '@/features/billing/api/billingApi'
import { entitlementsApi } from '@/features/entitlements/api/entitlementsApi'
import type { SubscriptionStatus } from '@/features/entitlements/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { formatMoney } from '@/shared/utils/formatMoney'
import styles from './TenantSubscriptionPage.module.css'

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente',
  INCOMPLETE: 'Pagamento incompleto',
  UNPAID: 'Não paga',
  PAUSED: 'Pausada',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
}

const INTERVAL_LABELS: Record<string, string> = { MONTHLY: 'mês', YEARLY: 'ano' }

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/**
 * Self-service de assinatura do Tenant via Stripe (ver ADR 0028, PARTE X) — dentro do
 * {@code MainLayout} (nunca uma tela isolada, ver `architecture.md`). Mostra plano/status atuais
 * (via {@code /entitlements}, mesma fonte do banner de acesso) e as ações disponíveis: contratar
 * (Checkout hospedado), gerenciar cobrança (Customer Portal) e cancelar. Nunca ativa nada
 * localmente — toda confirmação financeira vem do webhook (ver PARTE N).
 */
export function TenantSubscriptionPage() {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const { data: entitlements, isLoading: loadingEntitlements } = useQuery({
    queryKey: ['entitlements'],
    queryFn: entitlementsApi.current,
  })

  const { data: catalog, isLoading: loadingCatalog } = useQuery({
    queryKey: ['billing', 'catalog'],
    queryFn: billingApi.catalog,
  })

  const hasSubscription = Boolean(entitlements?.plan)
  const isReadOnlyDueToBilling =
    entitlements?.accessMode === 'READ_ONLY' && entitlements.accessReason !== 'TENANT_SUSPENDED'

  const checkoutMutation = useMutation({
    mutationFn: (planPriceId: string) => billingApi.createCheckoutSession(planPriceId),
    onSuccess: (checkout) => {
      window.location.href = checkout.checkoutUrl
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
  })

  const portalMutation = useMutation({
    mutationFn: billingApi.createCustomerPortalSession,
    onSuccess: (session) => {
      window.location.href = session.url
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
  })

  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancel('AT_PERIOD_END'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entitlements'] })
      setConfirmingCancel(false)
      setActionError(null)
    },
    onError: (error: unknown) => {
      setActionError(errorMessageFrom(error))
      setConfirmingCancel(false)
    },
  })

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Assinatura</h1>
        <p className={styles.subtitle}>Gerencie o plano, cobrança e pagamento da sua organização.</p>
      </header>

      {loadingEntitlements ? <p className={styles.hint}>Carregando…</p> : null}

      {entitlements ? (
        <div className={styles.card}>
          <div className={styles.currentInfo}>
            <div>
              <span className={styles.label}>Plano atual</span>
              <span className={styles.value}>{entitlements.plan?.name ?? 'Nenhum'}</span>
            </div>
            <div>
              <span className={styles.label}>Status</span>
              <span className={styles.statusBadge}>
                {entitlements.subscriptionStatus ? STATUS_LABELS[entitlements.subscriptionStatus] : 'Sem assinatura'}
              </span>
            </div>
          </div>

          {isReadOnlyDueToBilling ? (
            <p className={styles.errorMessage} role="alert">
              A organização está em modo somente leitura por causa da assinatura. Regularize o pagamento para
              recuperar o acesso completo.
            </p>
          ) : null}

          {actionError ? (
            <p className={styles.errorMessage} role="alert">
              {actionError}
            </p>
          ) : null}

          {hasSubscription ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? 'Abrindo…' : 'Gerenciar cobrança'}
              </button>
              <button type="button" className={styles.dangerButton} onClick={() => setConfirmingCancel(true)}>
                Cancelar assinatura
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.card}>
        <h2 className={styles.value}>{hasSubscription ? 'Alterar plano' : 'Escolha um plano'}</h2>
        {loadingCatalog ? <p className={styles.hint}>Carregando planos…</p> : null}
        {!loadingCatalog && catalog?.length === 0 ? (
          <p className={styles.hint}>Nenhum plano disponível para contratação no momento.</p>
        ) : null}
        <div className={styles.plansGrid}>
          {catalog?.map((entry) =>
            entry.prices.map((price) => (
              <div key={price.id} className={styles.planCard}>
                <span className={styles.planName}>{entry.name}</span>
                <span className={styles.planPrice}>{formatMoney(price.amountMinor, price.currency)}</span>
                <span className={styles.planPriceInterval}>por {INTERVAL_LABELS[price.billingInterval] ?? price.billingInterval}</span>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => checkoutMutation.mutate(price.id)}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? 'Redirecionando…' : hasSubscription ? 'Assinar' : 'Contratar'}
                </button>
              </div>
            )),
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancelar assinatura?"
        description="A assinatura permanece ativa até o fim do período vigente já pago — o cancelamento é agendado, nunca imediato por aqui. Você pode gerenciar isso também pelo Customer Portal."
        confirmLabel="Agendar cancelamento"
        isConfirming={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setConfirmingCancel(false)}
      />
    </section>
  )
}
