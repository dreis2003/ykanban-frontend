import { NotificationStatusBadge } from '@/features/notifications/components/NotificationStatusBadge/NotificationStatusBadge'
import type { NotificationSummary } from '@/features/notifications/types'
import { formatDateTime } from '@/shared/utils/formatDate'
import styles from './NotificationList.module.css'

interface Props {
  notifications: NotificationSummary[]
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onSelect: (notification: NotificationSummary) => void
}

export function NotificationList({ notifications, page, totalPages, onPageChange, onSelect }: Props) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table} data-testid="notifications-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Evento</th>
            <th>Canal</th>
            <th>Envio ao Hub</th>
            <th>Status remoto</th>
          </tr>
        </thead>
        <tbody>
          {notifications.map((notification) => (
            <tr
              key={notification.id}
              className={styles.row}
              onClick={() => onSelect(notification)}
              data-testid={`notification-row-${notification.id}`}
            >
              <td>{formatDateTime(notification.createdAt)}</td>
              <td>{notification.eventType}</td>
              <td>{notification.channel}</td>
              <td>
                <NotificationStatusBadge kind="dispatch" status={notification.dispatchStatus} />
              </td>
              <td>
                <NotificationStatusBadge kind="remote" status={notification.remoteStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 ? (
        <div className={styles.pagination}>
          <button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
            Anterior
          </button>
          <span>
            Página {page + 1} de {totalPages}
          </span>
          <button type="button" disabled={page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}>
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  )
}
