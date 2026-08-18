import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { billingCatalogApi } from '@/features/plans/api/billingCatalogApi'
import { plansApi } from '@/features/plans/api/plansApi'
import { PlanPricesSection } from '@/features/plans/components/PlanPricesSection/PlanPricesSection'
import { FEATURE_LABELS, LIMIT_LABELS } from '@/features/plans/constants'
import type { LimitMode, PlanDetail, PlanFeatureSlot, PlanLimitSlot } from '@/features/plans/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './PlatformPlanDetailPage.module.css'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

interface FeatureRowProps {
  slot: PlanFeatureSlot
  disabled: boolean
  isSaving: boolean
  onToggle: (enabled: boolean) => void
}

function FeatureRow({ slot, disabled, isSaving, onToggle }: FeatureRowProps) {
  return (
    <div className={styles.featureRow}>
      <span className={styles.featureName}>{FEATURE_LABELS[slot.key]}</span>
      <label className={styles.switch} data-checked={slot.enabled}>
        <input
          type="checkbox"
          role="switch"
          aria-label={FEATURE_LABELS[slot.key]}
          checked={slot.enabled}
          onChange={(event) => onToggle(event.target.checked)}
          disabled={disabled || isSaving}
        />
        <span className={styles.switchTrack} aria-hidden="true" />
      </label>
    </div>
  )
}

interface LimitRowProps {
  slot: PlanLimitSlot
  disabled: boolean
  isSaving: boolean
  onSave: (mode: LimitMode, value: number | null) => void
}

/** Sem estado derivado de props via effect de propósito: o pai remonta esta linha (via `key`,
 * incluindo `mode`/`value`) sempre que o servidor confirma uma mudança — o estado local começa
 * sempre a partir do valor persistido mais recente, sem sincronização manual. */
function LimitRow({ slot, disabled, isSaving, onSave }: LimitRowProps) {
  const [mode, setMode] = useState<LimitMode>(slot.mode ?? 'LIMITED')
  const [value, setValue] = useState<string>(slot.value != null ? String(slot.value) : '')
  const [fieldError, setFieldError] = useState<string | null>(null)

  function handleSave() {
    if (mode === 'UNLIMITED') {
      setFieldError(null)
      onSave('UNLIMITED', null)
      return
    }
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 0) {
      setFieldError('Informe um valor inteiro maior ou igual a zero.')
      return
    }
    setFieldError(null)
    onSave('LIMITED', parsed)
  }

  return (
    <div className={styles.limitRow}>
      <div className={styles.limitInfo}>
        <span className={styles.limitName}>{LIMIT_LABELS[slot.key]}</span>
        {!slot.configured ? <span className={styles.notConfiguredBadge}>Não configurado</span> : null}
      </div>
      <div className={styles.limitControls}>
        <label className={styles.radioOption}>
          <input
            type="radio"
            name={`limit-mode-${slot.key}`}
            checked={mode === 'LIMITED'}
            onChange={() => setMode('LIMITED')}
            disabled={disabled || isSaving}
          />
          Limitado
        </label>
        {mode === 'LIMITED' ? (
          <input
            type="number"
            min={0}
            className={styles.limitValueInput}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={disabled || isSaving}
            aria-label={`Valor de ${LIMIT_LABELS[slot.key]}`}
          />
        ) : null}
        <label className={styles.radioOption}>
          <input
            type="radio"
            name={`limit-mode-${slot.key}`}
            checked={mode === 'UNLIMITED'}
            onChange={() => setMode('UNLIMITED')}
            disabled={disabled || isSaving}
          />
          Ilimitado
        </label>
        <button type="button" className={styles.saveButton} onClick={handleSave} disabled={disabled || isSaving}>
          {isSaving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      {fieldError ? (
        <p className={styles.fieldError} role="alert">
          {fieldError}
        </p>
      ) : null}
    </div>
  )
}

/** Detalhe de um Plan — Informações, Features e Limites (ver ADR 0025). Features/Limites listam
 * SEMPRE todas as chaves conhecidas pelo sistema (mesmo não configuradas), permitindo enxergar de
 * antemão o que falta para ativar o plano. */
export function PlatformPlanDetailPage() {
  const { planId } = useParams<{ planId: string }>()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [displayOrderInput, setDisplayOrderInput] = useState('0')
  const [editError, setEditError] = useState<string | null>(null)
  const [savingFeatureKey, setSavingFeatureKey] = useState<string | null>(null)
  const [savingLimitKey, setSavingLimitKey] = useState<string | null>(null)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const {
    data: plan,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['platform', 'plans', planId],
    queryFn: () => plansApi.getById(planId as string),
    enabled: Boolean(planId),
  })

  const { data: stripeStatus } = useQuery({
    queryKey: ['platform', 'plans', planId, 'billing', 'stripe'],
    queryFn: () => billingCatalogApi.productStatus(planId as string),
    enabled: Boolean(planId),
  })

  const publishPlanMutation = useMutation({
    mutationFn: () => billingCatalogApi.publishPlan(planId as string),
    onSuccess: (status) => {
      queryClient.setQueryData(['platform', 'plans', planId, 'billing', 'stripe'], status)
      setActionError(null)
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
  })

  const applyDetail = (updated: PlanDetail) => {
    queryClient.setQueryData(['platform', 'plans', planId], updated)
    queryClient.invalidateQueries({ queryKey: ['platform', 'plans', 'list'] })
  }

  const updateMutation = useMutation({
    mutationFn: (values: { name: string; description: string; displayOrder: number }) =>
      plansApi.update(planId as string, values),
    onSuccess: (updated) => {
      queryClient.setQueryData(['platform', 'plans', planId], (previous: PlanDetail | undefined) =>
        previous ? { ...previous, ...updated } : previous,
      )
      queryClient.invalidateQueries({ queryKey: ['platform', 'plans', 'list'] })
      setIsEditing(false)
      setEditError(null)
    },
    onError: (error: unknown) => setEditError(errorMessageFrom(error)),
  })

  const setFeatureMutation = useMutation({
    mutationFn: ({ featureKey, enabled }: { featureKey: PlanFeatureSlot['key']; enabled: boolean }) =>
      plansApi.setFeature(planId as string, featureKey, enabled),
    onMutate: ({ featureKey }) => setSavingFeatureKey(featureKey),
    onSuccess: (updated) => {
      applyDetail(updated)
      setActionError(null)
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
    onSettled: () => setSavingFeatureKey(null),
  })

  const setLimitMutation = useMutation({
    mutationFn: ({ limitKey, mode, value }: { limitKey: PlanLimitSlot['key']; mode: LimitMode; value: number | null }) =>
      plansApi.setLimit(planId as string, limitKey, mode, value),
    onMutate: ({ limitKey }) => setSavingLimitKey(limitKey),
    onSuccess: (updated) => {
      applyDetail(updated)
      setActionError(null)
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
    onSettled: () => setSavingLimitKey(null),
  })

  const activateMutation = useMutation({
    mutationFn: () => plansApi.activate(planId as string),
    onSuccess: (updated) => {
      queryClient.setQueryData(['platform', 'plans', planId], (previous: PlanDetail | undefined) =>
        previous ? { ...previous, ...updated } : previous,
      )
      queryClient.invalidateQueries({ queryKey: ['platform', 'plans', 'list'] })
      setActionError(null)
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
  })

  const deactivateMutation = useMutation({
    mutationFn: () => plansApi.deactivate(planId as string),
    onSuccess: (updated) => {
      queryClient.setQueryData(['platform', 'plans', planId], (previous: PlanDetail | undefined) =>
        previous ? { ...previous, ...updated } : previous,
      )
      queryClient.invalidateQueries({ queryKey: ['platform', 'plans', 'list'] })
      setConfirmingDeactivate(false)
      setActionError(null)
    },
    onError: (error: unknown) => {
      setActionError(errorMessageFrom(error))
      setConfirmingDeactivate(false)
    },
  })

  function startEditing() {
    if (!plan) return
    setNameInput(plan.name)
    setDescriptionInput(plan.description ?? '')
    setDisplayOrderInput(String(plan.displayOrder))
    setEditError(null)
    setIsEditing(true)
  }

  function submitEdit() {
    const trimmedName = nameInput.trim()
    if (!trimmedName) {
      setEditError('Nome é obrigatório.')
      return
    }
    const parsedDisplayOrder = Number(displayOrderInput)
    if (!Number.isInteger(parsedDisplayOrder)) {
      setEditError('Ordem de exibição deve ser um número inteiro.')
      return
    }
    updateMutation.mutate({ name: trimmedName, description: descriptionInput.trim(), displayOrder: parsedDisplayOrder })
  }

  return (
    <section className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação">
        <Link to={ROUTES.platformPlans}>Planos</Link>
        {plan ? (
          <>
            <span aria-hidden="true">/</span>
            <span className={styles.breadcrumbCurrent}>{plan.name}</span>
          </>
        ) : null}
      </nav>

      {isLoading ? <StatusMessage variant="loading" title="Carregando plano…" /> : null}
      {isError ? <StatusMessage variant="error" title="Não foi possível carregar este plano." /> : null}

      {plan ? (
        <>
          <header className={styles.header}>
            <div>
              {isEditing ? (
                <div className={styles.editForm}>
                  <div className={styles.editField}>
                    <label className={styles.editLabel} htmlFor="plan-edit-name">
                      Nome
                    </label>
                    <input
                      id="plan-edit-name"
                      type="text"
                      className={styles.editInput}
                      value={nameInput}
                      onChange={(event) => setNameInput(event.target.value)}
                      disabled={updateMutation.isPending}
                      autoFocus
                    />
                  </div>
                  <div className={styles.editField}>
                    <label className={styles.editLabel} htmlFor="plan-edit-description">
                      Descrição
                    </label>
                    <textarea
                      id="plan-edit-description"
                      className={styles.editTextarea}
                      value={descriptionInput}
                      onChange={(event) => setDescriptionInput(event.target.value)}
                      disabled={updateMutation.isPending}
                      rows={2}
                    />
                  </div>
                  <div className={styles.editField}>
                    <label className={styles.editLabel} htmlFor="plan-edit-display-order">
                      Ordem de exibição
                    </label>
                    <input
                      id="plan-edit-display-order"
                      type="number"
                      className={styles.editInput}
                      value={displayOrderInput}
                      onChange={(event) => setDisplayOrderInput(event.target.value)}
                      disabled={updateMutation.isPending}
                    />
                  </div>
                  <div className={styles.editActions}>
                    <button
                      type="button"
                      className={styles.saveButton}
                      onClick={submitEdit}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => setIsEditing(false)}
                      disabled={updateMutation.isPending}
                    >
                      Cancelar
                    </button>
                  </div>
                  {editError ? (
                    <p className={styles.fieldError} role="alert">
                      {editError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <h1 className={styles.title}>
                    {plan.name}
                    <button type="button" className={styles.editButton} onClick={startEditing}>
                      Editar
                    </button>
                  </h1>
                  {plan.description ? <p className={styles.description}>{plan.description}</p> : null}
                  <p className={styles.code}>{plan.code}</p>
                </>
              )}
            </div>
            <span className={styles.statusBadge} data-status={plan.status}>
              {plan.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
            </span>
          </header>

          {actionError ? (
            <p className={styles.actionError} role="alert">
              {actionError}
            </p>
          ) : null}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Features</h2>
            <div className={styles.featureList}>
              {plan.features.map((slot) => (
                <FeatureRow
                  key={slot.key}
                  slot={slot}
                  disabled={setFeatureMutation.isPending && savingFeatureKey !== slot.key}
                  isSaving={savingFeatureKey === slot.key && setFeatureMutation.isPending}
                  onToggle={(enabled) => setFeatureMutation.mutate({ featureKey: slot.key, enabled })}
                />
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Stripe</h2>
            <div className={styles.featureRow}>
              <span className={styles.featureName}>
                {stripeStatus?.synced ? `Sincronizado — ${stripeStatus.externalProductId}` : 'Não publicado'}
              </span>
              <button
                type="button"
                className={styles.editButton}
                onClick={() => publishPlanMutation.mutate()}
                disabled={publishPlanMutation.isPending}
              >
                {publishPlanMutation.isPending ? 'Publicando…' : stripeStatus?.synced ? 'Tentar novamente' : 'Publicar na Stripe'}
              </button>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Preços</h2>
            <PlanPricesSection planId={plan.id} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Limites</h2>
            <div className={styles.limitList}>
              {plan.limits.map((slot) => (
                <LimitRow
                  key={`${slot.key}-${slot.mode ?? 'none'}-${slot.value ?? 'none'}`}
                  slot={slot}
                  disabled={setLimitMutation.isPending && savingLimitKey !== slot.key}
                  isSaving={savingLimitKey === slot.key && setLimitMutation.isPending}
                  onSave={(mode, value) => setLimitMutation.mutate({ limitKey: slot.key, mode, value })}
                />
              ))}
            </div>
          </section>

          <div className={styles.actions}>
            {plan.status === 'ACTIVE' ? (
              <button type="button" className={styles.dangerButton} onClick={() => setConfirmingDeactivate(true)}>
                Desativar plano
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => activateMutation.mutate()}
                disabled={activateMutation.isPending}
              >
                {activateMutation.isPending ? 'Ativando…' : 'Ativar plano'}
              </button>
            )}
          </div>

          <ConfirmDialog
            open={confirmingDeactivate}
            title={`Desativar ${plan.name}?`}
            description="O plano deixa de poder ser vinculado a novos Tenants até que seja reativado."
            confirmLabel="Desativar"
            isConfirming={deactivateMutation.isPending}
            onConfirm={() => deactivateMutation.mutate()}
            onCancel={() => setConfirmingDeactivate(false)}
          />
        </>
      ) : null}
    </section>
  )
}
