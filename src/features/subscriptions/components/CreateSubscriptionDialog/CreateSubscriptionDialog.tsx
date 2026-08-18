import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { plansApi } from '@/features/plans/api/plansApi'
import { subscriptionsApi } from '@/features/subscriptions/api/subscriptionsApi'
import { ApiError } from '@/shared/api/apiError'
import styles from './CreateSubscriptionDialog.module.css'

interface Props {
  tenantId: string
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/** Criação manual de Subscription pela plataforma (ver ADR 0026, itens 114-118) — só para Tenants
 * sem assinatura efetiva no momento (Section já garante isso, mas o backend também valida). */
export function CreateSubscriptionDialog({ tenantId, open, onClose, onCreated }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const [planId, setPlanId] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'TRIALING'>('ACTIVE')
  const [trialEndsAt, setTrialEndsAt] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['platform', 'plans', 'assignable'],
    queryFn: plansApi.assignable,
    enabled: open,
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setPlanId('')
      setStatus('ACTIVE')
      setTrialEndsAt('')
      setFieldError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Derivado no render (nunca em efeito, ver react-hooks/set-state-in-effect) — mesmo padrão de
  // CreateTenantDialog.
  const selectedPlanId = planId || plans?.[0]?.id || ''

  const createMutation = useMutation({
    mutationFn: () =>
      subscriptionsApi.create(tenantId, {
        planId: selectedPlanId,
        status,
        ...(status === 'TRIALING' && trialEndsAt ? { trialEndsAt: new Date(trialEndsAt).toISOString() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants', tenantId] })
      onCreated()
      onClose()
    },
    onError: (error: unknown) => setFieldError(errorMessageFrom(error)),
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPlanId) {
      setFieldError('Selecione um plano.')
      return
    }
    if (status === 'TRIALING' && !trialEndsAt) {
      setFieldError('Informe a data de término do trial.')
      return
    }
    setFieldError(null)
    createMutation.mutate()
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.title}>Criar assinatura</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="subscription-plan">
            Plano
          </label>
          <select
            id="subscription-plan"
            className={styles.input}
            value={selectedPlanId}
            onChange={(event) => setPlanId(event.target.value)}
            disabled={createMutation.isPending || isLoadingPlans}
          >
            {(plans ?? []).map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="subscription-status">
            Status inicial
          </label>
          <select
            id="subscription-status"
            className={styles.input}
            value={status}
            onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'TRIALING')}
            disabled={createMutation.isPending}
          >
            <option value="ACTIVE">Ativa</option>
            <option value="TRIALING">Em teste (trial)</option>
          </select>
        </div>

        {status === 'TRIALING' ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="subscription-trial-ends-at">
              Trial até
            </label>
            <input
              id="subscription-trial-ends-at"
              type="datetime-local"
              className={styles.input}
              value={trialEndsAt}
              onChange={(event) => setTrialEndsAt(event.target.value)}
              disabled={createMutation.isPending}
            />
          </div>
        ) : null}

        {fieldError ? (
          <p className={styles.fieldError} role="alert">
            {fieldError}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={createMutation.isPending}>
            Cancelar
          </button>
          <button type="submit" className={styles.submit} disabled={createMutation.isPending || !selectedPlanId}>
            {createMutation.isPending ? 'Criando…' : 'Criar assinatura'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
