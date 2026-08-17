import { AlertTriangle } from 'lucide-react'
import { resolveWipStatus } from '@/features/board/utils/wipStatus'
import type { ColumnWipMetric } from '@/features/metrics/types'
import styles from './WipHealthSection.module.css'

interface Props {
  wip: ColumnWipMetric[]
}

/** Só colunas com limite definido chegam aqui (ver {@code CurrentMetricsResponse.wip} no
 * backend) — colunas sem WIP não são tratadas como problema (ver ADR 0018). */
export function WipHealthSection({ wip }: Props) {
  const overLimitCount = wip.filter((w) => resolveWipStatus(w.wipLimit, w.cardCount) === 'OVER_LIMIT').length
  const atLimitCount = wip.filter((w) => resolveWipStatus(w.wipLimit, w.cardCount) === 'AT_LIMIT').length

  return (
    <section className={styles.section}>
      <div className={styles.headingRow}>
        <h3 className={styles.heading}>Saúde do Fluxo</h3>
        {wip.length > 0 ? (
          <span className={styles.summary} data-has-issue={overLimitCount > 0 || atLimitCount > 0}>
            {overLimitCount > 0 ? `${overLimitCount} coluna(s) acima do limite` : null}
            {overLimitCount > 0 && atLimitCount > 0 ? ' · ' : null}
            {atLimitCount > 0 ? `${atLimitCount} coluna(s) no limite` : null}
            {overLimitCount === 0 && atLimitCount === 0 ? 'Nenhuma coluna acima do limite' : null}
          </span>
        ) : null}
      </div>

      {wip.length === 0 ? (
        <p className={styles.empty}>Nenhuma coluna com limite de WIP configurado.</p>
      ) : (
        <ul className={styles.list}>
          {wip.map((column) => {
            const status = resolveWipStatus(column.wipLimit, column.cardCount)
            return (
              <li key={column.columnId} className={styles.row} data-status={status}>
                <span className={styles.columnName}>{column.columnName}</span>
                <span className={styles.count}>
                  {column.cardCount} / {column.wipLimit}
                </span>
                {status === 'AT_LIMIT' ? <span className={styles.statusText}>Limite atingido</span> : null}
                {status === 'OVER_LIMIT' ? (
                  <span className={styles.statusText}>
                    <AlertTriangle size={12} aria-hidden="true" /> {column.cardCount - column.wipLimit} acima do limite
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
