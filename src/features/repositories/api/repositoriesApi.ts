import { httpClient } from '@/shared/api/httpClient'
import type {
  CreateGitRepositoryRequest,
  GitRepository,
  RepositoryStatus,
  UpdateGitRepositoryRequest,
} from '@/features/repositories/types'

export const repositoriesApi = {
  list: (projectId: string, status: RepositoryStatus | 'ALL' = 'ALL') =>
    httpClient.get<GitRepository[]>(`/projects/${projectId}/repositories?status=${status}`),
  get: (projectId: string, repositoryId: string) =>
    httpClient.get<GitRepository>(`/projects/${projectId}/repositories/${repositoryId}`),
  create: (projectId: string, payload: CreateGitRepositoryRequest) =>
    httpClient.post<GitRepository>(`/projects/${projectId}/repositories`, payload),
  update: (projectId: string, repositoryId: string, payload: UpdateGitRepositoryRequest) =>
    httpClient.patch<GitRepository>(`/projects/${projectId}/repositories/${repositoryId}`, payload),
  archive: (projectId: string, repositoryId: string) =>
    httpClient.post<GitRepository>(`/projects/${projectId}/repositories/${repositoryId}/archive`),
  reactivate: (projectId: string, repositoryId: string) =>
    httpClient.post<GitRepository>(`/projects/${projectId}/repositories/${repositoryId}/reactivate`),
}
