import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { resolveWipStatus } from '@/features/board/utils/wipStatus'
import { formatRelativeAge } from '@/features/metrics/utils/formatDuration'
import type { CurrentMetrics } from '@/features/metrics/types'
import styles from './AttentionSection.module.css'

interface Props {
  projectId: string
  metrics: CurrentMetrics
}

/**
 * Consolida indicadores reais que já existem em outras seções (bloqueados, CRITICAL, OVER WIP,
 * sem responsável) — nunca um "risk score" inventado (ver ADR 0018 / agent_docs). Cada indicador
 * navega para o Board já filtrado, reaproveitando o mecanismo do Prompt 16 (nunca uma busca
 * paralela nova).
 */
export function AttentionSection({ projectId, metrics }: Props) {
  const criticalCount = metrics.byPriority.CRITICAL ?? 0
  const overWipColumns = metrics.wip.filter((w) => resolveWipStatus(w.wipLimit, w.cardCount) === 'OVER_LIMIT')
  const hasNothingToShow =
    metrics.blockedCards === 0 && criticalCount === 0 && overWipColumns.length === 0 && metrics.unassignedCards === 0

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Atenção</h3>

      {hasNothingToShow ? (
        <p className={styles.empty}>Nenhum ponto de atenção no momento.</p>
      ) : (
        <ul className={styles.indicatorList}>
          {metrics.blockedCards > 0 ? (
            <li>
              <Link to={`${ROUTES.projectDetail(projectId)}?blocked=true`} className={styles.indicator}>
                <AlertTriangle size={14} aria-hidden="true" />
                {metrics.blockedCards} card{metrics.blockedCards === 1 ? '' : 's'} bloqueado
                {metrics.blockedCards === 1 ? '' : 's'}
              </Link>
            </li>
          ) : null}
          {criticalCount > 0 ? (
            <li>
              <Link to={`${ROUTES.projectDetail(projectId)}?priorities=CRITICAL`} className={styles.indicator}>
                <AlertTriangle size={14} aria-hidden="true" />
                {criticalCount} card{criticalCount === 1 ? '' : 's'} com prioridade crítica
              </Link>
            </li>
          ) : null}
          {metrics.unassignedCards > 0 ? (
            <li>
              <Link to={`${ROUTES.projectDetail(projectId)}?unassigned=true`} className={styles.indicator}>
                <AlertTriangle size={14} aria-hidden="true" />
                {metrics.unassignedCards} card{metrics.unassignedCards === 1 ? '' : 's'} sem responsável
              </Link>
            </li>
          ) : null}
          {overWipColumns.map((column) => (
            <li key={column.columnId}>
              <Link to={ROUTES.projectDetail(projectId)} className={styles.indicator}>
                <AlertTriangle size={14} aria-hidden="true" />
                {column.columnName} acima do WIP ({column.cardCount}/{column.wipLimit})
              </Link>
            </li>
          ))}
        </ul>
      )}

      {metrics.oldestBlockedCards.length > 0 ? (
        <div className={styles.oldestBlocked}>
          <h4 className={styles.subheading}>Bloqueios mais antigos</h4>
          <ul className={styles.blockedList}>
            {metrics.oldestBlockedCards.map((card) => (
              <li key={card.cardId} className={styles.blockedRow}>
                <Link to={ROUTES.cardDetail(projectId, card.cardId)} className={styles.cardKey}>
                  {card.cardKey}
                </Link>
                <span className={styles.cardTitle}>{card.cardTitle}</span>
                <span className={styles.blockedAge}>{formatRelativeAge(card.blockedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
