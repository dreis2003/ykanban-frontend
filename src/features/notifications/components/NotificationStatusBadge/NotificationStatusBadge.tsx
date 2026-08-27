import { dispatchStatusLabel, remoteStatusLabel } from '@/features/notifications/labels'
import styles from './NotificationStatusBadge.module.css'

interface Props {
  kind: 'dispatch' | 'remote'
  status: string | null
}

/** Nunca depende só de cor — o texto do label sempre acompanha, mesmo para status desconhecidos
 * (fallback seguro em `labels.ts`, nunca quebra renderizando o valor cru). */
export function NotificationStatusBadge({ kind, status }: Props) {
  const label = kind === 'dispatch' ? dispatchStatusLabel(status ?? '') : remoteStatusLabel(status)
  const dataStatus = status ?? 'NONE'

  return (
    <span className={styles.badge} data-kind={kind} data-status={dataStatus}>
      {label}
    </span>
  )
}
