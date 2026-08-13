import type { ProjectSummary } from '@/features/projects/types'
import styles from './ProjectsSummary.module.css'

interface Props {
  summary: ProjectSummary
}

export function ProjectsSummary({ summary }: Props) {
  return (
    <dl className={styles.grid} aria-label="Resumo dos projetos">
      <div className={styles.tile}>
        <dt>Total de Projetos</dt>
        <dd>{summary.total}</dd>
      </div>
      <div className={styles.tile}>
        <dt>Projetos Ativos</dt>
        <dd>{summary.active}</dd>
      </div>
      <div className={styles.tile}>
        <dt>Projetos Arquivados</dt>
        <dd>{summary.archived}</dd>
      </div>
    </dl>
  )
}
