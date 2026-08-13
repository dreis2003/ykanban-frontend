import styles from './StatusBadge.module.css'

interface Props {
  status: 'ACTIVE' | 'ARCHIVED'
}

const LABELS: Record<Props['status'], string> = {
  ACTIVE: 'Ativo',
  ARCHIVED: 'Arquivado',
}

export function StatusBadge({ status }: Props) {
  return (
    <span className={styles.status} data-status={status}>
      {LABELS[status]}
    </span>
  )
}
