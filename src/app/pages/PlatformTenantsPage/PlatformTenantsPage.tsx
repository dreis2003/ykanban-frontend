import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateTenantDialog } from '@/features/platform/components/CreateTenantDialog/CreateTenantDialog'
import { PlatformTenantsTable } from '@/features/platform/components/PlatformTenantsTable/PlatformTenantsTable'
import { platformApi } from '@/features/platform/api/platformApi'
import { ApiError } from '@/shared/api/apiError'
import styles from './PlatformTenantsPage.module.css'

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/** Listagem/gestão de Tenants pela plataforma SaaS (ver ADR 0023) — cache TanStack Query sob a
 * chave `['platform', ...]`, nunca compartilhada com listas tenant-scoped como `['projects', ...]`. */
export function PlatformTenantsPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: ({ name, slug }: { name: string; slug: string }) => platformApi.createTenant(name, slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] })
      queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] })
      setCreateOpen(false)
      setCreateError(null)
    },
    onError: (error: unknown) => setCreateError(errorMessageFrom(error)),
  })

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Empresas</h1>
          <p className={styles.subtitle}>Organizações cadastradas na plataforma YKanban</p>
        </div>
      </header>

      <PlatformTenantsTable
        onCreateTenant={() => {
          setCreateError(null)
          setCreateOpen(true)
        }}
      />

      <CreateTenantDialog
        open={createOpen}
        isSubmitting={createMutation.isPending}
        errorMessage={createError}
        onSubmit={(values) => createMutation.mutate(values)}
        onClose={() => setCreateOpen(false)}
      />
    </section>
  )
}
