import { httpClient } from '@/shared/api/httpClient'
import type {
  CreateProjectRequest,
  ListProjectsParams,
  Project,
  ProjectSummary,
  UpdateProjectRequest,
} from '@/features/projects/types'
import type { PageResponse } from '@/shared/types/pageResponse'

const DEFAULT_PAGE_SIZE = 20

function buildListQuery(params: ListProjectsParams): string {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? DEFAULT_PAGE_SIZE))
  query.set('sort', params.sort ?? 'name,asc')
  if (params.status) {
    query.set('status', params.status)
  }
  if (params.search) {
    query.set('search', params.search)
  }
  return query.toString()
}

export const projectsApi = {
  list: (params: ListProjectsParams) =>
    httpClient.get<PageResponse<Project>>(`/projects?${buildListQuery(params)}`),
  summary: () => httpClient.get<ProjectSummary>('/projects/summary'),
  get: (id: string) => httpClient.get<Project>(`/projects/${id}`),
  create: (payload: CreateProjectRequest) => httpClient.post<Project>('/projects', payload),
  update: (id: string, payload: UpdateProjectRequest) =>
    httpClient.put<Project>(`/projects/${id}`, payload),
  archive: (id: string) => httpClient.post<Project>(`/projects/${id}/archive`),
  activate: (id: string) => httpClient.post<Project>(`/projects/${id}/activate`),
}
