import { httpClient } from '@/shared/api/httpClient'
import type { Board, UpdateKanbanColumnRequest } from '@/features/board/types'

export const boardApi = {
  get: (projectId: string) => httpClient.get<Board>(`/projects/${projectId}/board`),
  updateColumn: (projectId: string, columnId: string, payload: UpdateKanbanColumnRequest) =>
    httpClient.patch<Board>(`/projects/${projectId}/board/columns/${columnId}`, payload),
}
