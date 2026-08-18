import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LimitKey } from '@/features/entitlements/types'
import { subscriptionsApi } from '@/features/subscriptions/api/subscriptionsApi'
import { ChangePlanDialog } from '@/features/subscriptions/components/ChangePlanDialog/ChangePlanDialog'
import { CreateSubscriptionDialog } from '@/features/subscriptions/components/CreateSubscriptionDialog/CreateSubscriptionDialog'
import { LIMIT_LABELS } from '@/features/subscriptions/labels'
import type { SubscriptionSource, SubscriptionStatus } from '@/features/subscriptions/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { formatDateTime } from '@/shared/utils/formatDate'
import styles from './SubscriptionSection.module.css'

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Ativa',
  TRIALING: 'Em teste',
  PAST_DUE: 'Pagamento pendente',
  INCOMPLETE: 'Pagamento incompleto',
  UNPAID: 'Não paga',
  PAUSED: 'Pausada',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
}

const SOURCE_LABELS: Record<SubscriptionSource, string> = {
  LEGACY_MIGRATION: 'Migração (legado)',
  PLATFORM_MANUAL: 'Platform Admin',
  BILLING_PROVIDER: 'Billing provider',
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

interface Props {
  tenantId: string
}

/** Seção "Assinatura" do Tenant detail pela plataforma (ver ADR 0026, PARTE J) — 409
 * {@code NO_ACTIVE_SUBSCRIPTION} não é um erro de carregamento, é um estado de negócio legítimo
 * (organização ainda sem Subscription, ou cancelada), então nunca é tratado como
 * {@code StatusMessage variant="error"}. */
export function SubscriptionSection({ tenantId }: Props) {
  const queryClient = useQueryClient()
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const {
    data: subscription,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['platform', 'tenants', tenantId, 'subscription'],
    queryFn: () => subscriptionsApi.getCurrent(tenantId),
    retry: false,
  })

  const hasNoActiveSubscription = error instanceof ApiError && error.status === 409

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['platform', 'tenants', tenantId, 'subscription'] })
    queryClient.invalidateQueries({ queryKey: ['platform', 'tenants', tenantId, 'subscriptions'] })
  }

  const cancelMutation = useMutation({
    mutationFn: () => subscriptionsApi.cancel(tenantId),
    onSuccess: () => {
      invalidate()
      setConfirmingCancel(false)
      setActionError(null)
    },
    onError: (mutationError: unknown) => {
      setActionError(errorMessageFrom(mutationError))
      setConfirmingCancel(false)
    },
  })

  const limitKeys = subscription?.limits ? (Object.keys(subscription.limits) as LimitKey[]) : []

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Assinatura</h2>
      </div>

      {isLoading ? <p className={styles.hint}>Carregando assinatura…</p> : null}

      {hasNoActiveSubscription ? (
        <div className={styles.noSubscription}>
          <p>Esta organização não possui uma assinatura ativa no momento — está em modo somente leitura.</p>
          <button type="button" className={styles.primaryButton} onClick={() => setCreateOpen(true)}>
            Criar assinatura
          </button>
        </div>
      ) : null}

      {error && !hasNoActiveSubscription ? (
        <p className={styles.actionError} role="alert">
          Não foi possível carregar a assinatura desta organização.
        </p>
      ) : null}

      {subscription ? (
        <>
          <div className={styles.subscriptionInfo}>
            <div>
              <span className={styles.label}>Plano</span>
              <span className={styles.value}>
                {subscription.plan.name}
                {subscription.plan.code === 'LEGACY_INTERNAL' ? ' — Plano legado do sistema' : ''}
              </span>
            </div>
            <div>
              <span className={styles.label}>Status</span>
              <span className={styles.statusBadge} data-status={subscription.status}>
                {STATUS_LABELS[subscription.status]}
              </span>
            </div>
            <div>
              <span className={styles.label}>Início</span>
              <span className={styles.value}>{new Date(subscription.startedAt).toLocaleDateString('pt-BR')}</span>
            </div>
            {subscription.trialEndsAt ? (
              <div>
                <span className={styles.label}>Trial até</span>
                <span className={styles.value}>{new Date(subscription.trialEndsAt).toLocaleString('pt-BR')}</span>
              </div>
            ) : null}
            <div>
              <span className={styles.label}>Origem</span>
              <span className={styles.value}>{SOURCE_LABELS[subscription.source]}</span>
            </div>
            {subscription.managementMode === 'PROVIDER_MANAGED' ? (
              <>
                <div>
                  <span className={styles.label}>Provider</span>
                  <span className={styles.value}>{subscription.billingProvider}</span>
                </div>
                {subscription.currentPeriodStart && subscription.currentPeriodEnd ? (
                  <div>
                    <span className={styles.label}>Período vigente</span>
                    <span className={styles.value}>
                      {new Date(subscription.currentPeriodStart).toLocaleDateString('pt-BR')} —{' '}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ) : null}
                {subscription.pastDueSince ? (
                  <div>
                    <span className={styles.label}>Pagamento pendente desde</span>
                    <span className={styles.value}>{formatDateTime(subscription.pastDueSince)}</span>
                  </div>
                ) : null}
                {subscription.cancelAtPeriodEnd ? (
                  <div>
                    <span className={styles.label}>Cancelamento agendado</span>
                    <span className={styles.value}>Para o fim do período vigente</span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          {limitKeys.length > 0 ? (
            <div className={styles.limitsGrid}>
              {limitKeys.map((key) => {
                const limit = subscription.limits?.[key]
                if (!limit) return null
                return (
                  <div key={key} className={styles.limitCard} data-state={limit.state}>
                    <span className={styles.limitLabel}>{LIMIT_LABELS[key]}</span>
                    <span className={styles.limitValue}>
                      {limit.usage} / {limit.mode === 'UNLIMITED' ? 'Ilimitado' : limit.value}
                    </span>
                    {limit.state === 'OVER_LIMIT' ? <span className={styles.limitWarning}>Acima do limite</span> : null}
                    {limit.state === 'AT_LIMIT' ? <span className={styles.limitWarning}>Limite atingido</span> : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {actionError ? (
            <p className={styles.actionError} role="alert">
              {actionError}
            </p>
          ) : null}

          {subscription.managementMode === 'PROVIDER_MANAGED' ? (
            <p className={styles.hint}>
              Assinatura gerenciada pelo billing provider — mudanças de plano/cancelamento ainda não têm uma tela própria
              nesta fase (ver Prompt 28).
            </p>
          ) : (
            <div className={styles.subscriptionActions}>
              <button type="button" className={styles.actionButton} onClick={() => setChangePlanOpen(true)}>
                Alterar plano
              </button>
              <button type="button" className={styles.actionButtonDanger} onClick={() => setConfirmingCancel(true)}>
                Cancelar assinatura
              </button>
            </div>
          )}
        </>
      ) : null}

      <ChangePlanDialog
        tenantId={tenantId}
        open={changePlanOpen}
        currentPlanId={subscription?.plan.id ?? null}
        onClose={() => setChangePlanOpen(false)}
        onChanged={invalidate}
      />

      <CreateSubscriptionDialog tenantId={tenantId} open={createOpen} onClose={() => setCreateOpen(false)} onCreated={invalidate} />

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancelar assinatura desta organização?"
        description="A organização continuará podendo consultar seus dados, mas ficará em modo somente leitura até que uma nova assinatura seja criada. Nenhum dado é removido."
        confirmLabel="Cancelar assinatura"
        isConfirming={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setConfirmingCancel(false)}
      />
    </section>
  )
}
