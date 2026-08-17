import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { CARD_PRIORITY_LABELS, CARD_TYPE_LABELS } from '@/features/card/labels'
import type { CardPriority, CardType } from '@/features/card/types'
import { AttentionSection } from '@/features/metrics/components/AttentionSection/AttentionSection'
import { ColumnDistributionChart } from '@/features/metrics/components/ColumnDistributionChart/ColumnDistributionChart'
import { DeliveryMetrics } from '@/features/metrics/components/DeliveryMetrics/DeliveryMetrics'
import { DistributionBars } from '@/features/metrics/components/DistributionBars/DistributionBars'
import { KpiCard } from '@/features/metrics/components/KpiCard/KpiCard'
import { PeriodSelector } from '@/features/metrics/components/PeriodSelector/PeriodSelector'
import { WipHealthSection } from '@/features/metrics/components/WipHealthSection/WipHealthSection'
import { metricsApi } from '@/features/metrics/api/metricsApi'
import type { MetricsPeriod } from '@/features/metrics/types'
import { projectsApi } from '@/features/projects/api/projectsApi'
import { ProjectPageHeader } from '@/features/projects/components/ProjectPageHeader/ProjectPageHeader'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ProjectDashboardPage.module.css'

const ALL_TYPES: CardType[] = ['FEATURE', 'BUG', 'REFACTOR', 'TECH', 'SPIKE']
const ALL_PRIORITIES: CardPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

/**
 * Visão gerencial/operacional do Project — sempre dados reais derivados de Card/CardHistory
 * existentes, nunca dados fictícios (ver ADR 0018). Complementar ao Kanban (`ProjectDetailPage`),
 * nunca o substitui — a navegação entre os dois vive em `ProjectPageHeader`.
 */
export function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [period, setPeriod] = useState<MetricsPeriod>('30d')

  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
  } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId as string),
    enabled: Boolean(projectId),
  })

  const {
    data: current,
    isError: isCurrentError,
    refetch: refetchCurrent,
  } = useQuery({
    queryKey: ['projectMetrics', 'current', projectId],
    queryFn: () => metricsApi.getCurrent(projectId as string),
    enabled: Boolean(projectId),
  })

  const {
    data: flow,
    isError: isFlowError,
    refetch: refetchFlow,
  } = useQuery({
    queryKey: ['projectMetrics', 'flow', projectId, period],
    queryFn: () => metricsApi.getFlow(projectId as string, period),
    enabled: Boolean(projectId),
  })

  const typeItems = ALL_TYPES.map((type) => ({ key: type, label: CARD_TYPE_LABELS[type], count: current?.byType[type] ?? 0 }))
  const priorityItems = ALL_PRIORITIES.map((priority) => ({
    key: priority,
    label: CARD_PRIORITY_LABELS[priority],
    count: current?.byPriority[priority] ?? 0,
  }))
  const assigneeItems =
    current?.byAssignee.map((entry) => ({
      key: entry.assigneeId ?? 'unassigned',
      label: entry.assigneeName ?? 'Sem responsável',
      count: entry.cardCount,
      inactive: entry.inactive,
    })) ?? []

  return (
    <section className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação">
        <Link to={ROUTES.projects}>Projetos</Link>
        {project ? (
          <>
            <span aria-hidden="true">/</span>
            <span className={styles.breadcrumbCurrent}>{project.name}</span>
          </>
        ) : null}
      </nav>

      {isProjectLoading ? <StatusMessage variant="loading" title="Carregando projeto…" /> : null}
      {isProjectError ? <StatusMessage variant="error" title="Não foi possível carregar o projeto." /> : null}

      {project ? (
        <>
          <ProjectPageHeader project={project} active="dashboard" />

          {isCurrentError ? (
            <StatusMessage
              variant="error"
              title="Não foi possível carregar as métricas atuais."
              action={
                <button type="button" className={styles.retryButton} onClick={() => refetchCurrent()}>
                  Tentar novamente
                </button>
              }
            />
          ) : null}

          {!current && !isCurrentError ? <StatusMessage variant="loading" title="Carregando métricas…" /> : null}

          {current ? (
            <>
              <div className={styles.kpiGrid}>
                <KpiCard title="Total de Cards" value={current.totalCards} />
                <KpiCard title="Em Desenvolvimento" value={current.doingCards} />
                <KpiCard
                  title="Bloqueados"
                  value={current.blockedCards}
                  to={`${ROUTES.projectDetail(project.id)}?blocked=true`}
                  {...(current.totalCards > 0 && current.blockedCards > 0
                    ? { description: `${Math.round((current.blockedCards / current.totalCards) * 100)}% do total` }
                    : {})}
                />
                <KpiCard
                  title="Sem Responsável"
                  value={current.unassignedCards}
                  to={`${ROUTES.projectDetail(project.id)}?unassigned=true`}
                />
                <KpiCard title="Em Produção" value={current.productionCards} />
              </div>

              {current.totalCards === 0 ? (
                <StatusMessage variant="empty" title="Nenhum card criado ainda." />
              ) : (
                <>
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Fluxo Atual</h2>
                    <ColumnDistributionChart columns={current.byColumn} />
                  </section>

                  <section className={styles.section}>
                    <WipHealthSection wip={current.wip} />
                  </section>

                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Distribuição</h2>
                    <div className={styles.distributionGrid}>
                      <DistributionBars title="Por Tipo" items={typeItems} />
                      <DistributionBars title="Por Prioridade" items={priorityItems} />
                    </div>
                  </section>

                  <section className={styles.section}>
                    <DistributionBars title="Carga Atual — Por Responsável" items={assigneeItems} />
                  </section>

                  <section className={styles.section}>
                    <AttentionSection projectId={project.id} metrics={current} />
                  </section>
                </>
              )}
            </>
          ) : null}

          <section className={styles.section}>
            <div className={styles.periodRow}>
              <h2 className={styles.sectionTitle}>Entrega</h2>
              <PeriodSelector value={period} onChange={setPeriod} />
            </div>
            {isFlowError ? (
              <StatusMessage
                variant="error"
                title="Não foi possível carregar as métricas de fluxo."
                action={
                  <button type="button" className={styles.retryButton} onClick={() => refetchFlow()}>
                    Tentar novamente
                  </button>
                }
              />
            ) : null}
            {!flow && !isFlowError ? <StatusMessage variant="loading" title="Carregando métricas de fluxo…" /> : null}
            {flow ? <DeliveryMetrics flow={flow} /> : null}
          </section>
        </>
      ) : null}
    </section>
  )
}
