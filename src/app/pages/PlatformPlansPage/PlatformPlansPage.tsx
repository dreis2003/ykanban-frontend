import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { plansApi } from '@/features/plans/api/plansApi'
import { CreatePlanDialog } from '@/features/plans/components/CreatePlanDialog/CreatePlanDialog'
import { PlansTable } from '@/features/plans/components/PlansTable/PlansTable'
import { ApiError } from '@/shared/api/apiError'
import styles from './PlatformPlansPage.module.css'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/** Listagem/gestão do catálogo de Planos pela plataforma SaaS (ver ADR 0025). Um plano novo sempre
 * nasce {@code INACTIVE} — a ativação acontece na tela de detalhe, depois de Features/Limits
 * configurados. */
export function PlatformPlansPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: plansApi.create,
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] })
      setCreateOpen(false)
      setCreateError(null)
      navigate(ROUTES.platformPlanDetail(plan.id))
    },
    onError: (error: unknown) => setCreateError(errorMessageFrom(error)),
  })

  function openCreateDialog() {
    setCreateError(null)
    setCreateOpen(true)
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Planos</h1>
          <p className={styles.subtitle}>Catálogo de planos, features e limites da plataforma YKanban</p>
        </div>
      </header>

      <PlansTable onCreatePlan={openCreateDialog} />

      <CreatePlanDialog
        open={createOpen}
        isSubmitting={createMutation.isPending}
        errorMessage={createError}
        onSubmit={(values) => createMutation.mutate(values)}
        onClose={() => setCreateOpen(false)}
      />
    </section>
  )
}
