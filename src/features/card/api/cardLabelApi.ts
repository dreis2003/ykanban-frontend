import { httpClient } from '@/shared/api/httpClient'
import type { CardLabelSummary } from '@/features/card/types'

export const cardLabelApi = {
  assign: (cardId: string, labelId: string) =>
    httpClient.post<CardLabelSummary[]>(`/cards/${cardId}/labels/${labelId}`),
  remove: (cardId: string, labelId: string) =>
    httpClient.delete<CardLabelSummary[]>(`/cards/${cardId}/labels/${labelId}`),
}
