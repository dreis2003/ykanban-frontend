import { useState } from 'react'
import { NotificationStatusBadge } from '@/features/notifications/components/NotificationStatusBadge/NotificationStatusBadge'
import { aggregateNotificationStatusLabel, remoteStatusLabel, routeStatusLabel } from '@/features/notifications/labels'
import type { NotificationDetail } from '@/features/notifications/types'
import { formatDateTime } from '@/shared/utils/formatDate'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './NotificationDetailDrawer.module.css'

interface Props {
  detail: NotificationDetail | undefined
  isLoading: boolean
  isError: boolean
  onClose: () => void
}

export function NotificationDetailDrawer({ detail, isLoading, isError, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopyId(messageId: string) {
    try {
      await navigator.clipboard.writeText(messageId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Falha silenciosa: cópia é uma conveniência, não uma operação crítica.
    }
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe da notificação"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3>Detalhe da Notificação</h3>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {isLoading ? <StatusMessage variant="loading" title="Carregando detalhe..." /> : null}
        {isError ? <StatusMessage variant="error" title="Falha ao carregar detalhe da notificação." /> : null}

        {!isLoading && !isError && detail && detail.deliveryMode === 'POLICY' ? (
          <div className={styles.content} data-testid="notification-policy-detail">
            <dl className={styles.fields}>
              <dt>Evento</dt>
              <dd>{detail.eventType}</dd>

              <dt>Data de criação</dt>
              <dd>{formatDateTime(detail.createdAt)}</dd>

              <dt>Envio ao Hub</dt>
              <dd>
                <NotificationStatusBadge kind="dispatch" status={detail.dispatchStatus} />
                {detail.dispatchedAt ? <span className={styles.subtext}> em {formatDateTime(detail.dispatchedAt)}</span> : null}
              </dd>

              <dt>Política</dt>
              <dd>{detail.policyCode}</dd>

              {detail.recipientRef ? (
                <>
                  <dt>Destinatário</dt>
                  <dd data-testid="notification-recipient-ref">
                    <code>{detail.recipientRef}</code>
                  </dd>
                </>
              ) : null}

              <dt>Roteamento</dt>
              <dd>
                <span data-testid="notification-routing-status">{aggregateNotificationStatusLabel(detail.remoteNotificationStatus)}</span>
                {detail.remoteNotificationStatusUpdatedAt ? (
                  <span className={styles.subtext}> em {formatDateTime(detail.remoteNotificationStatusUpdatedAt)}</span>
                ) : null}
              </dd>

              {detail.lastError ? (
                <>
                  <dt>Último erro</dt>
                  <dd className={styles.errorText}>{detail.lastError}</dd>
                </>
              ) : null}
            </dl>

            <h4 className={styles.timelineTitle}>Tentativas</h4>
            {detail.routes && detail.routes.length > 0 ? (
              <ol className={styles.timeline} data-testid="notification-routes-list">
                {[...detail.routes]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((route) => (
                    <li key={route.sequence} className={styles.timelineEntry}>
                      <span className={styles.timelineTime}>
                        {route.sequence}. {route.channel}
                      </span>
                      <span className={styles.timelineStatus}>
                        {routeStatusLabel(route.remoteMessageStatus, route.routeState, route.skipReason)}
                      </span>
                      {route.ycommunicationMessageId ? (
                        <span className={styles.messageIdRow}>
                          <code>{route.ycommunicationMessageId}</code>
                          <button
                            type="button"
                            className={styles.copyButton}
                            onClick={() => handleCopyId(route.ycommunicationMessageId as string)}
                          >
                            {copied ? 'Copiado!' : 'Copiar ID'}
                          </button>
                        </span>
                      ) : null}
                    </li>
                  ))}
              </ol>
            ) : (
              <p className={styles.subtext}>Nenhuma route ativada ainda para esta notificação.</p>
            )}
          </div>
        ) : null}

        {!isLoading && !isError && detail && detail.deliveryMode !== 'POLICY' ? (
          <div className={styles.content}>
            <dl className={styles.fields}>
              <dt>Evento</dt>
              <dd>{detail.eventType}</dd>

              <dt>Canal</dt>
              <dd>{detail.channel}</dd>

              <dt>Data de criação</dt>
              <dd>{formatDateTime(detail.createdAt)}</dd>

              <dt>Envio ao Hub</dt>
              <dd>
                <NotificationStatusBadge kind="dispatch" status={detail.dispatchStatus} />
                {detail.dispatchedAt ? <span className={styles.subtext}> em {formatDateTime(detail.dispatchedAt)}</span> : null}
              </dd>

              {detail.ycommunicationMessageId ? (
                <>
                  <dt>YCommunication Message ID</dt>
                  <dd className={styles.messageIdRow}>
                    <code>{detail.ycommunicationMessageId}</code>
                    <button
                      type="button"
                      className={styles.copyButton}
                      onClick={() => handleCopyId(detail.ycommunicationMessageId as string)}
                    >
                      {copied ? 'Copiado!' : 'Copiar ID'}
                    </button>
                  </dd>
                </>
              ) : null}

              <dt>Status remoto</dt>
              <dd>
                <NotificationStatusBadge kind="remote" status={detail.remoteStatus} />
                {detail.remoteStatusUpdatedAt ? (
                  <span className={styles.subtext}> em {formatDateTime(detail.remoteStatusUpdatedAt)}</span>
                ) : null}
              </dd>

              {detail.lastError ? (
                <>
                  <dt>Último erro</dt>
                  <dd className={styles.errorText}>{detail.lastError}</dd>
                </>
              ) : null}
            </dl>

            <h4 className={styles.timelineTitle}>Histórico de Delivery Receipts</h4>
            {detail.history.length > 0 ? (
              <ol className={styles.timeline} data-testid="notification-history-timeline">
                {detail.history.map((entry, index) => (
                  <li key={`${entry.status}-${entry.occurredAt}-${index}`} className={styles.timelineEntry}>
                    <span className={styles.timelineTime}>{formatDateTime(entry.occurredAt)}</span>
                    <span className={styles.timelineStatus}>{remoteStatusLabel(entry.status)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.subtext}>Nenhum delivery receipt recebido ainda para esta notificação.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
