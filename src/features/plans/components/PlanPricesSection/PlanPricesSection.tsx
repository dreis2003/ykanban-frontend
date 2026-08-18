import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingCatalogApi } from '@/features/plans/api/billingCatalogApi'
import { plansApi } from '@/features/plans/api/plansApi'
import type { BillingInterval, PlanPrice } from '@/features/plans/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { formatMoney } from '@/shared/utils/formatMoney'
import styles from './PlanPricesSection.module.css'

/** Status de sincronização Stripe de UM preço (ver ADR 0028, item 185/187) — consulta e publica
 * isoladamente, nunca bloqueia a listagem dos demais preços. */
function PriceStripeStatus({ planId, planPriceId }: { planId: string; planPriceId: string }) {
  const queryClient = useQueryClient()
  const queryKey = ['platform', 'plans', planId, 'prices', planPriceId, 'billing', 'stripe']

  const { data: status } = useQuery({ queryKey, queryFn: () => billingCatalogApi.priceStatus(planId, planPriceId) })

  const publishMutation = useMutation({
    mutationFn: () => billingCatalogApi.publishPrice(planId, planPriceId),
    onSuccess: (updated) => queryClient.setQueryData(queryKey, updated),
  })

  return (
    <span className={styles.stripeStatus}>
      {status?.synced ? `Stripe: ${status.externalPriceId}` : (
        <button type="button" className={styles.publishButton} onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
          {publishMutation.isPending ? 'Publicando…' : 'Publicar na Stripe'}
        </button>
      )}
    </span>
  )
}

const INTERVAL_LABELS: Record<BillingInterval, string> = {
  MONTHLY: 'Mensal',
  YEARLY: 'Anual',
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

interface Props {
  planId: string
}

/** Preços comerciais de um Plan (ver ADR 0027) — nunca edita um preço existente: trocar de preço é
 * sempre "criar um novo ACTIVE, inativar o antigo" (mesma regra do domínio, refletida aqui: não há
 * botão de editar, só "Novo preço"/"Inativar"). */
export function PlanPricesSection({ planId }: Props) {
  const queryClient = useQueryClient()
  const queryKey = ['platform', 'plans', planId, 'prices']

  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY')
  const [currency, setCurrency] = useState('BRL')
  const [amount, setAmount] = useState('')
  const [displayOrder, setDisplayOrder] = useState('1')
  const [formError, setFormError] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState<PlanPrice | null>(null)

  const { data: prices, isLoading } = useQuery({
    queryKey,
    queryFn: () => plansApi.listPrices(planId),
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const parsedAmount = Number(amount.replace(',', '.'))
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        throw new Error('Informe um valor válido maior ou igual a zero.')
      }
      const parsedDisplayOrder = Number(displayOrder)
      if (!Number.isInteger(parsedDisplayOrder)) {
        throw new Error('Ordem de exibição deve ser um número inteiro.')
      }
      return plansApi.createPrice(planId, {
        billingInterval,
        currency: currency.trim().toUpperCase(),
        amountMinor: Math.round(parsedAmount * 100),
        displayOrder: parsedDisplayOrder,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setAmount('')
      setFormError(null)
    },
    onError: (error: unknown) => setFormError(errorMessageFrom(error)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (planPrice: PlanPrice) => plansApi.deactivatePrice(planId, planPrice.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setDeactivating(null)
    },
    onError: () => setDeactivating(null),
  })

  return (
    <>
      <div className={styles.list}>
        {isLoading ? <p className={styles.empty}>Carregando preços…</p> : null}
        {!isLoading && prices?.length === 0 ? (
          <p className={styles.empty}>Nenhum preço cadastrado ainda.</p>
        ) : null}
        {prices?.map((price) => (
          <div key={price.id} className={styles.row}>
            <div className={styles.rowInfo}>
              <span className={styles.amount}>{formatMoney(price.amountMinor, price.currency)}</span>
              <span className={styles.interval}>/ {INTERVAL_LABELS[price.billingInterval].toLowerCase()}</span>
              <span className={styles.statusBadge} data-status={price.status}>
                {price.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
              </span>
              {price.status === 'ACTIVE' ? <PriceStripeStatus planId={planId} planPriceId={price.id} /> : null}
            </div>
            {price.status === 'ACTIVE' ? (
              <button type="button" className={styles.dangerButton} onClick={() => setDeactivating(price)}>
                Inativar
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="price-interval">
            Periodicidade
          </label>
          <select
            id="price-interval"
            className={styles.select}
            value={billingInterval}
            onChange={(event) => setBillingInterval(event.target.value as BillingInterval)}
          >
            <option value="MONTHLY">Mensal</option>
            <option value="YEARLY">Anual</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="price-currency">
            Moeda
          </label>
          <input
            id="price-currency"
            type="text"
            className={`${styles.input} ${styles.currencyInput}`}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            maxLength={3}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="price-amount">
            Valor
          </label>
          <input
            id="price-amount"
            type="text"
            inputMode="decimal"
            className={`${styles.input} ${styles.amountInput}`}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="price-display-order">
            Ordem
          </label>
          <input
            id="price-display-order"
            type="number"
            className={styles.input}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
          />
        </div>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !amount.trim() || !currency.trim()}
        >
          {createMutation.isPending ? 'Adicionando…' : 'Novo preço'}
        </button>
      </div>
      {formError ? (
        <p className={styles.fieldError} role="alert">
          {formError}
        </p>
      ) : null}

      <ConfirmDialog
        open={deactivating != null}
        title="Inativar preço?"
        description="Novas assinaturas não poderão mais usar este preço. Assinaturas já existentes não são afetadas."
        confirmLabel="Inativar"
        isConfirming={deactivateMutation.isPending}
        onConfirm={() => deactivating && deactivateMutation.mutate(deactivating)}
        onCancel={() => setDeactivating(null)}
      />
    </>
  )
}
