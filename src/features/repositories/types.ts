export type RepositoryKind =
  | 'BACKEND'
  | 'FRONTEND'
  | 'FULLSTACK'
  | 'MOBILE'
  | 'GITOPS'
  | 'INFRASTRUCTURE'
  | 'LIBRARY'
  | 'DOCUMENTATION'
  | 'OTHER'

export type RepositoryStatus = 'ACTIVE' | 'ARCHIVED'

export interface GitRepository {
  id: string
  projectId: string
  name: string
  description: string | null
  kind: RepositoryKind
  remoteUrl: string
  defaultBranch: string
  status: RepositoryStatus
  createdAt: string
  updatedAt: string
}

export interface CreateGitRepositoryRequest {
  name: string
  description?: string
  kind: RepositoryKind
  remoteUrl: string
  defaultBranch?: string
}

export interface UpdateGitRepositoryRequest {
  name: string
  description?: string
  kind: RepositoryKind
  remoteUrl: string
  defaultBranch: string
}

export const REPOSITORY_KIND_LABELS: Record<RepositoryKind, string> = {
  BACKEND: 'Backend',
  FRONTEND: 'Frontend',
  FULLSTACK: 'Full Stack',
  MOBILE: 'Mobile',
  GITOPS: 'GitOps',
  INFRASTRUCTURE: 'Infraestrutura',
  LIBRARY: 'Biblioteca',
  DOCUMENTATION: 'Documentação',
  OTHER: 'Outro',
}

export const REPOSITORY_KIND_OPTIONS: RepositoryKind[] = [
  'BACKEND',
  'FRONTEND',
  'FULLSTACK',
  'MOBILE',
  'GITOPS',
  'INFRASTRUCTURE',
  'LIBRARY',
  'DOCUMENTATION',
  'OTHER',
]
