import { httpClient } from '@/shared/api/httpClient'
import type {
  RepositoryTechnicalConfiguration,
  SaveRepositoryTechnicalConfigurationRequest,
} from '@/features/technicalConfiguration/types'

export const technicalConfigurationApi = {
  get: (projectId: string, repositoryId: string) =>
    httpClient.get<RepositoryTechnicalConfiguration>(
      `/projects/${projectId}/repositories/${repositoryId}/technical-configuration`,
    ),
  save: (projectId: string, repositoryId: string, payload: SaveRepositoryTechnicalConfigurationRequest) =>
    httpClient.put<RepositoryTechnicalConfiguration>(
      `/projects/${projectId}/repositories/${repositoryId}/technical-configuration`,
      payload,
    ),
}
