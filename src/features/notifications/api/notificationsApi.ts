import { httpClient } from '@/shared/api/httpClient'
import type { PageResponse } from '@/shared/types/pageResponse'
import type { ListNotificationsParams, NotificationDetail, NotificationSummary } from '@/features/notifications/types'

const DEFAULT_PAGE_SIZE = 20

function buildListQuery(params: ListNotificationsParams): string {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? DEFAULT_PAGE_SIZE))
  if (params.channel) {
    query.set('channel', params.channel)
  }
  if (params.dispatchStatus) {
    query.set('dispatchStatus', params.dispatchStatus)
  }
  if (params.remoteStatus) {
    query.set('remoteStatus', params.remoteStatus)
  }
  if (params.eventType) {
    query.set('eventType', params.eventType)
  }
  return query.toString()
}

export const notificationsApi = {
  list: (projectId: string, params: ListNotificationsParams = {}) =>
    httpClient.get<PageResponse<NotificationSummary>>(
      `/projects/${projectId}/notifications?${buildListQuery(params)}`,
    ),

  getDetail: (projectId: string, notificationId: string) =>
    httpClient.get<NotificationDetail>(`/projects/${projectId}/notifications/${notificationId}`),
}
