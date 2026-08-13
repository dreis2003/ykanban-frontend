import { httpClient } from '@/shared/api/httpClient'
import type { PageResponse } from '@/shared/types/pageResponse'
import type { Card, CreateCardRequest, ListCardsParams, UpdateCardRequest } from '@/features/card/types'

const DEFAULT_PAGE_SIZE = 200

function buildListQuery(params: ListCardsParams): string {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? DEFAULT_PAGE_SIZE))
  if (params.type) {
    query.set('type', params.type)
  }
  if (params.priority) {
    query.set('priority', params.priority)
  }
  if (params.columnId) {
    query.set('columnId', params.columnId)
  }
  return query.toString()
}

export const cardApi = {
  list: (projectId: string, params: ListCardsParams = {}) =>
    httpClient.get<PageResponse<Card>>(`/projects/${projectId}/cards?${buildListQuery(params)}`),
  get: (cardId: string) => httpClient.get<Card>(`/cards/${cardId}`),
  getByKey: (key: string) => httpClient.get<Card>(`/cards/key/${key}`),
  create: (projectId: string, payload: CreateCardRequest) =>
    httpClient.post<Card>(`/projects/${projectId}/cards`, payload),
  update: (cardId: string, payload: UpdateCardRequest) => httpClient.patch<Card>(`/cards/${cardId}`, payload),
}
