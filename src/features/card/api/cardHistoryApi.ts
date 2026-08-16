import { httpClient } from '@/shared/api/httpClient'
import type { PageResponse } from '@/shared/types/pageResponse'
import type { CardHistoryEvent } from '@/features/card/types'

export const CARD_HISTORY_PAGE_SIZE = 20

export const cardHistoryApi = {
  list: (cardId: string, page: number, size: number = CARD_HISTORY_PAGE_SIZE) =>
    httpClient.get<PageResponse<CardHistoryEvent>>(`/cards/${cardId}/history?page=${page}&size=${size}`),
}
