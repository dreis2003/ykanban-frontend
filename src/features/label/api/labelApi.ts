import { httpClient } from '@/shared/api/httpClient'
import type { CreateLabelRequest, Label, UpdateLabelRequest } from '@/features/label/types'

export const labelApi = {
  list: (projectId: string) => httpClient.get<Label[]>(`/projects/${projectId}/labels`),
  create: (projectId: string, payload: CreateLabelRequest) =>
    httpClient.post<Label>(`/projects/${projectId}/labels`, payload),
  update: (projectId: string, labelId: string, payload: UpdateLabelRequest) =>
    httpClient.patch<Label>(`/projects/${projectId}/labels/${labelId}`, payload),
  remove: (projectId: string, labelId: string) => httpClient.delete<void>(`/projects/${projectId}/labels/${labelId}`),
}
