import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { CreateTenantDialog } from '@/features/platform/components/CreateTenantDialog/CreateTenantDialog'
import { PlatformTenantsTable } from '@/features/platform/components/PlatformTenantsTable/PlatformTenantsTable'
import { platformApi } from '@/features/platform/api/platformApi'
import { plansApi } from '@/features/plans/api/plansApi'
import { ApiError } from '@/shared/api/apiError'
import styles from './PlatformTenantsPage.module.css'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/** Listagem/gestão de Tenants pela plataforma SaaS (ver ADR 0023/0024) — cache TanStack Query sob
 * a chave `['platform', ...]`, nunca compartilhada com listas tenant-scoped como
 * `['projects', ...]`. */
export function PlatformTenantsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const { data: assignablePlans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['platform', 'plans', 'assignable'],
    queryFn: plansApi.assignable,
    enabled: createOpen,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, slug, adminEmail, planId }: { name: string; slug: string; adminEmail: string; planId: string }) =>
      platformApi.createTenant(name, slug, adminEmail, planId, idempotencyKey),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] })
      queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] })
      setCreateOpen(false)
      setCreateError(null)
      navigate(ROUTES.platformTenantDetail(result.tenant.id), {
        state: { justProvisioned: true, adminEmail: result.initialAdminInvitation.email, emailSent: result.initialAdminInvitation.emailSent },
      })
    },
    onError: (error: unknown) => setCreateError(errorMessageFrom(error)),
  })

  function openCreateDialog() {
    setCreateError(null)
    setIdempotencyKey(crypto.randomUUID())
    setCreateOpen(true)
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Empresas</h1>
          <p className={styles.subtitle}>Organizações cadastradas na plataforma YKanban</p>
        </div>
      </header>

      <PlatformTenantsTable onCreateTenant={openCreateDialog} />

      <CreateTenantDialog
        open={createOpen}
        isSubmitting={createMutation.isPending}
        errorMessage={createError}
        plans={assignablePlans ?? []}
        isLoadingPlans={isLoadingPlans}
        onSubmit={(values) => createMutation.mutate(values)}
        onClose={() => setCreateOpen(false)}
      />
    </section>
  )
}
