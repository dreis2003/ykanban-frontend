import { httpClient } from '@/shared/api/httpClient'
import type { Card } from '@/features/card/types'

export const cardBlockApi = {
  block: (cardId: string, reason: string) => httpClient.post<Card>(`/cards/${cardId}/block`, { reason }),
  unblock: (cardId: string) => httpClient.post<Card>(`/cards/${cardId}/unblock`),
}
