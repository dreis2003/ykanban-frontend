export interface NotificationSummary {
  id: string
  eventType: string
  channel: string
  dispatchStatus: string
  remoteStatus: string | null
  createdAt: string
  dispatchedAt: string | null
  remoteStatusUpdatedAt: string | null
}

export interface NotificationHistoryEntry {
  status: string
  occurredAt: string
}

/** Uma Route ativada de uma Notification Policy (YCOM-018) — nunca inclui destination; uma route
 * FALLBACK ainda não ativada tem `ycommunicationMessageId`/`remoteMessageStatus` ambos `null`.
 * YCOM-019: `routeState`/`skipReason` distinguem uma route PENDING (fallback ainda não tentada) de
 * uma route SKIPPED (nunca será usada, por preferência/contato indisponível/fallback desnecessário). */
export interface NotificationRoute {
  sequence: number
  channel: string
  ycommunicationMessageId: string | null
  remoteMessageStatus: string | null
  remoteStatusUpdatedAt: string | null
  routeState?: string | null
  skipReason?: string | null
}

export type DeliveryMode = 'TEMPLATE' | 'POLICY'

export interface NotificationDetail extends NotificationSummary {
  ycommunicationMessageId: string | null
  lastError: string | null
  history: NotificationHistoryEntry[]
  deliveryMode?: DeliveryMode
  policyCode?: string | null
  externalNotificationId?: string | null
  remoteNotificationStatus?: string | null
  remoteNotificationStatusUpdatedAt?: string | null
  routes?: NotificationRoute[]
  /** YCOM-019 — referência opaca ao Recipient Profile do YCommunication; presente apenas quando a
   * Policy resolvida era `recipientRequired`. Nunca contém dado de contato. */
  recipientRef?: string | null
}

export interface ListNotificationsParams {
  page?: number
  size?: number
  channel?: string
  dispatchStatus?: string
  remoteStatus?: string
  eventType?: string
}
