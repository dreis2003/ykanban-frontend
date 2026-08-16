import { httpClient } from '@/shared/api/httpClient'
import type { PageResponse } from '@/shared/types/pageResponse'
import type { Comment, CreateCommentRequest, UpdateCommentRequest } from '@/features/card/types'

export const COMMENT_PAGE_SIZE = 20

export const commentApi = {
  create: (cardId: string, payload: CreateCommentRequest) =>
    httpClient.post<Comment>(`/cards/${cardId}/comments`, payload),
  list: (cardId: string, page: number, size: number = COMMENT_PAGE_SIZE) =>
    httpClient.get<PageResponse<Comment>>(`/cards/${cardId}/comments?page=${page}&size=${size}`),
  update: (cardId: string, commentId: string, payload: UpdateCommentRequest) =>
    httpClient.patch<Comment>(`/cards/${cardId}/comments/${commentId}`, payload),
  remove: (cardId: string, commentId: string) =>
    httpClient.delete<void>(`/cards/${cardId}/comments/${commentId}`),
}
