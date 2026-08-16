import { httpClient } from '@/shared/api/httpClient'
import type { Card } from '@/features/card/types'

export const cardAssigneeApi = {
  assign: (cardId: string, userId: string) => httpClient.post<Card>(`/cards/${cardId}/assignee`, { userId }),
  unassign: (cardId: string) => httpClient.delete<Card>(`/cards/${cardId}/assignee`),
}
