export type ProjectStatus = 'ACTIVE' | 'ARCHIVED'

export interface Project {
  id: string
  code: string
  name: string
  description: string | null
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export interface CreateProjectRequest {
  code: string
  name: string
  description?: string
}

export interface UpdateProjectRequest {
  name: string
  description?: string
}

export type ProjectSortOption = 'name,asc' | 'name,desc' | 'createdAt,desc' | 'updatedAt,desc' | 'code,asc'

export interface ListProjectsParams {
  status?: ProjectStatus
  search?: string
  page?: number
  size?: number
  sort?: ProjectSortOption
}

export interface ProjectSummary {
  total: number
  active: number
  archived: number
}
