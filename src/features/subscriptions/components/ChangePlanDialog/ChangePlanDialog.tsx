import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LimitKey } from '@/features/entitlements/types'
import { plansApi } from '@/features/plans/api/plansApi'
import { subscriptionsApi } from '@/features/subscriptions/api/subscriptionsApi'
import { featureLabel, LIMIT_LABELS } from '@/features/subscriptions/labels'
import { ApiError } from '@/shared/api/apiError'
import styles from './ChangePlanDialog.module.css'

interface Props {
  tenantId: string
  open: boolean
  currentPlanId: string | null
  onClose: () => void
  onChanged: () => void
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/** Troca de Plano com preview obrigatório antes de confirmar (ver ADR 0026, itens 119-127) — o
 * backend não depende da confirmação para segurança (revalida tudo de novo ao aplicar), mas a UI
 * sempre mostra o impacto antes de deixar confirmar. */
export function ChangePlanDialog({ tenantId, open, currentPlanId, onClose, onChanged }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const [targetPlanId, setTargetPlanId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['platform', 'plans', 'assignable'],
    queryFn: plansApi.assignable,
    enabled: open,
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setTargetPlanId('')
      setError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const {
    data: preview,
    isFetching: isLoadingPreview,
    isError: isPreviewError,
  } = useQuery({
    queryKey: ['platform', 'tenants', tenantId, 'subscription', 'change-plan-preview', targetPlanId],
    queryFn: () => subscriptionsApi.previewChangePlan(tenantId, targetPlanId),
    enabled: open && Boolean(targetPlanId),
  })

  const changePlanMutation = useMutation({
    mutationFn: () => subscriptionsApi.changePlan(tenantId, targetPlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants', tenantId] })
      onChanged()
      onClose()
    },
    onError: (mutationError: unknown) => setError(errorMessageFrom(mutationError)),
  })

  const selectablePlans = (plans ?? []).filter((plan) => plan.id !== currentPlanId)
  const limitKeys = preview?.limits ? (Object.keys(preview.limits) as LimitKey[]) : []
  const hasOverLimitWarning = limitKeys.some((key) => preview?.limits[key]?.willBeOverLimit)

  return (
    <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose}>
      <div className={styles.form}>
        <h2 className={styles.title}>Alterar plano</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="change-plan-target">
            Novo plano
          </label>
          <select
            id="change-plan-target"
            className={styles.input}
            value={targetPlanId}
            onChange={(event) => setTargetPlanId(event.target.value)}
            disabled={changePlanMutation.isPending || isLoadingPlans}
          >
            <option value="">Selecione um plano…</option>
            {selectablePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>

        {isLoadingPreview ? <p className={styles.previewInfo}>Calculando impacto…</p> : null}
        {isPreviewError ? (
          <p className={styles.fieldError} role="alert">
            Não foi possível calcular o impacto desta troca.
          </p>
        ) : null}

        {preview ? (
          <div className={styles.preview}>
            {limitKeys.map((key) => {
              const limit = preview.limits[key]
              if (!limit) return null
              return (
                <div key={key} className={styles.previewRow}>
                  <span>{LIMIT_LABELS[key]}</span>
                  <span>
                    {limit.usage} em uso → limite {limit.targetMode === 'UNLIMITED' ? 'ilimitado' : limit.targetLimit}
                    {limit.willBeOverLimit ? <span className={styles.previewWarning}> · ficará acima do limite</span> : null}
                  </span>
                </div>
              )
            })}

            {preview.featuresLost.length > 0 ? (
              <div className={styles.featureList}>
                <strong>Recursos que deixarão de estar disponíveis:</strong>
                {preview.featuresLost.map((key) => (
                  <span key={key}>- {featureLabel(key)}</span>
                ))}
              </div>
            ) : null}

            {preview.featuresGained.length > 0 ? (
              <div className={styles.featureList}>
                <strong>Novos recursos disponíveis:</strong>
                {preview.featuresGained.map((key) => (
                  <span key={key}>- {featureLabel(key)}</span>
                ))}
              </div>
            ) : null}

            {hasOverLimitWarning ? (
              <p className={styles.previewInfo}>
                Nenhum usuário ou projeto será removido automaticamente. Novos usuários e projetos ficarão bloqueados até que o uso
                volte aos limites do plano.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={changePlanMutation.isPending}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.submit}
            onClick={() => changePlanMutation.mutate()}
            disabled={changePlanMutation.isPending || !targetPlanId || !preview}
          >
            {changePlanMutation.isPending ? 'Alterando…' : 'Alterar plano'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
