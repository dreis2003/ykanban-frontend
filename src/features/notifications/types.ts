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

export interface NotificationDetail extends NotificationSummary {
  ycommunicationMessageId: string | null
  lastError: string | null
  history: NotificationHistoryEntry[]
}

export interface ListNotificationsParams {
  page?: number
  size?: number
  channel?: string
  dispatchStatus?: string
  remoteStatus?: string
  eventType?: string
}
