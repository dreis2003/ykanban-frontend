import { httpClient } from '@/shared/api/httpClient'
import type { Card, CardSearchCriteria, CreateCardRequest, MoveCardRequest, UpdateCardRequest } from '@/features/card/types'

function buildListQuery(criteria: CardSearchCriteria): string {
  const query = new URLSearchParams()
  if (criteria.search) {
    query.set('search', criteria.search)
  }
  if (criteria.types?.length) {
    query.set('types', criteria.types.join(','))
  }
  if (criteria.priorities?.length) {
    query.set('priorities', criteria.priorities.join(','))
  }
  if (criteria.columnId) {
    query.set('columnId', criteria.columnId)
  }
  if (criteria.labelIds?.length) {
    query.set('labelIds', criteria.labelIds.join(','))
  }
  if (criteria.unassigned) {
    query.set('unassigned', 'true')
  } else if (criteria.assigneeId) {
    query.set('assigneeId', criteria.assigneeId)
  }
  if (criteria.blocked !== undefined) {
    query.set('blocked', String(criteria.blocked))
  }
  return query.toString()
}

export const cardApi = {
  list: (projectId: string, criteria: CardSearchCriteria = {}) => {
    const queryString = buildListQuery(criteria)
    return httpClient.get<Card[]>(`/projects/${projectId}/cards${queryString ? `?${queryString}` : ''}`)
  },
  get: (cardId: string) => httpClient.get<Card>(`/cards/${cardId}`),
  getByKey: (key: string) => httpClient.get<Card>(`/cards/key/${key}`),
  create: (projectId: string, payload: CreateCardRequest) =>
    httpClient.post<Card>(`/projects/${projectId}/cards`, payload),
  update: (cardId: string, payload: UpdateCardRequest) => httpClient.patch<Card>(`/cards/${cardId}`, payload),
  move: (cardId: string, payload: MoveCardRequest) => httpClient.post<Card>(`/cards/${cardId}/move`, payload),
}
