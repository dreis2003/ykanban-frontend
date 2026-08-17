import { useQuery } from '@tanstack/react-query'
import { ROUTES } from '@/app/router/routes'
import { platformApi } from '@/features/platform/api/platformApi'
import { KpiCard } from '@/features/metrics/components/KpiCard/KpiCard'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './PlatformDashboardPage.module.css'

/** Métricas agregadas da plataforma SaaS (ver ADR 0023) — deliberadamente sem nenhum dado
 * financeiro (billing/plano/assinatura estão fora de escopo). Cache sob `['platform', ...]`,
 * nunca compartilhado com métricas de Tenant (`['projectMetrics', ...]`). */
export function PlatformDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['platform', 'dashboard'],
    queryFn: () => platformApi.dashboard(),
  })

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Visão geral das organizações na plataforma YKanban</p>
      </header>

      {isLoading ? <StatusMessage variant="loading" title="Carregando métricas…" /> : null}

      {isError ? (
        <StatusMessage
          variant="error"
          title="Não foi possível carregar as métricas da plataforma."
          action={
            <button type="button" className={styles.retryButton} onClick={() => refetch()}>
              Tentar novamente
            </button>
          }
        />
      ) : null}

      {data ? (
        <div className={styles.kpiGrid}>
          <KpiCard title="Total de Organizações" value={data.totalTenants} to={ROUTES.platformTenants} />
          <KpiCard
            title="Ativas"
            value={data.activeTenants}
            to={`${ROUTES.platformTenants}?status=ACTIVE`}
          />
          <KpiCard
            title="Suspensas"
            value={data.suspendedTenants}
            to={`${ROUTES.platformTenants}?status=SUSPENDED`}
          />
          <KpiCard title="Usuários Únicos" value={data.uniqueUsers} />
          <KpiCard title="Total de Projetos" value={data.totalProjects} />
        </div>
      ) : null}
    </section>
  )
}
