import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import { projectsApi } from '@/features/projects/api/projectsApi'
import { ProjectPageHeader } from '@/features/projects/components/ProjectPageHeader/ProjectPageHeader'
import { repositoriesApi } from '@/features/repositories/api/repositoriesApi'
import { RepositoryFormDialog } from '@/features/repositories/components/RepositoryFormDialog/RepositoryFormDialog'
import { RepositoryRow } from '@/features/repositories/components/RepositoryRow/RepositoryRow'
import type {
  CreateGitRepositoryRequest,
  GitRepository,
  RepositoryStatus,
  UpdateGitRepositoryRequest,
} from '@/features/repositories/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ProjectRepositoriesPage.module.css'

type StatusFilter = RepositoryStatus | 'ALL'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'ARCHIVED', label: 'Arquivados' },
  { value: 'ALL', label: 'Todos' },
]

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

type FormState = { mode: 'create' } | { mode: 'edit'; repository: GitRepository }

export function ProjectRepositoriesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { membershipRole } = useAuth()
  const canManage = membershipRole === 'ADMIN' || membershipRole === 'PROJECT_MANAGER'
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE')
  const [formState, setFormState] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<GitRepository | null>(null)

  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId as string),
    enabled: Boolean(projectId),
  })

  const {
    data: repositories,
    isLoading: isListLoading,
    isError: isListError,
  } = useQuery({
    queryKey: ['project-repositories', projectId, statusFilter],
    queryFn: () => repositoriesApi.list(projectId as string, statusFilter),
    enabled: Boolean(projectId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['project-repositories', projectId] })

  const createMutation = useMutation({
    mutationFn: (payload: CreateGitRepositoryRequest) => repositoriesApi.create(projectId as string, payload),
    onSuccess: () => {
      invalidate()
      setFormState(null)
      setFormError(null)
    },
    onError: (error: unknown) => setFormError(errorMessageFrom(error)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGitRepositoryRequest }) =>
      repositoriesApi.update(projectId as string, id, payload),
    onSuccess: () => {
      invalidate()
      setFormState(null)
      setFormError(null)
    },
    onError: (error: unknown) => setFormError(errorMessageFrom(error)),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => repositoriesApi.archive(projectId as string, id),
    onSuccess: () => {
      invalidate()
      setArchiveTarget(null)
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => repositoriesApi.reactivate(projectId as string, id),
    onSuccess: invalidate,
  })

  function openCreateForm() {
    setFormError(null)
    setFormState({ mode: 'create' })
  }

  function openEditForm(repository: GitRepository) {
    setFormError(null)
    setFormState({ mode: 'edit', repository })
  }

  function closeForm() {
    setFormState(null)
    setFormError(null)
  }

  function handleFormSubmit(values: {
    name: string
    description: string
    kind: GitRepository['kind']
    remoteUrl: string
    defaultBranch: string
  }) {
    if (formState?.mode === 'create') {
      createMutation.mutate({
        name: values.name,
        kind: values.kind,
        remoteUrl: values.remoteUrl,
        ...(values.description ? { description: values.description } : {}),
        ...(values.defaultBranch ? { defaultBranch: values.defaultBranch } : {}),
      })
    } else if (formState?.mode === 'edit') {
      updateMutation.mutate({
        id: formState.repository.id,
        payload: {
          name: values.name,
          kind: values.kind,
          remoteUrl: values.remoteUrl,
          defaultBranch: values.defaultBranch,
          ...(values.description ? { description: values.description } : {}),
        },
      })
    }
  }

  if (isProjectLoading) {
    return <StatusMessage variant="loading" title="Carregando projeto…" />
  }

  if (!project) {
    return <StatusMessage variant="error" title="Não foi possível carregar o projeto." />
  }

  const isLoading = isListLoading
  const items = repositories ?? []
  // Evita dois botões "Adicionar repositório" simultâneos: com a lista vazia, a única ação fica
  // no estado vazio (mais próxima do contexto); com itens (ou ainda carregando/com erro), fica no
  // cabeçalho da seção.
  const showHeaderCreateButton = canManage && (isLoading || isListError || items.length > 0)

  return (
    <section className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação">
        <Link to={ROUTES.projects}>Projetos</Link>
        <span aria-hidden="true">/</span>
        <span className={styles.breadcrumbCurrent}>{project.name}</span>
      </nav>

      <ProjectPageHeader project={project} active="repositories" />

      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Repositórios</h2>
          <p className={styles.sectionSubtitle}>
            Repositórios Git associados a este projeto — base para futuras integrações com GitHub e execução de
            agentes de IA.
          </p>
        </div>
        {showHeaderCreateButton ? (
          <button type="button" className={styles.newButton} onClick={openCreateForm}>
            <Plus size={16} aria-hidden="true" />
            Adicionar repositório
          </button>
        ) : null}
      </div>

      <div className={styles.filters} role="tablist" aria-label="Filtrar por status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.value}
            className={styles.filterButton}
            data-active={statusFilter === tab.value}
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? <StatusMessage variant="loading" title="Carregando repositórios…" /> : null}

      {isListError ? <StatusMessage variant="error" title="Não foi possível carregar os repositórios." /> : null}

      {!isLoading && !isListError && items.length === 0 ? (
        <StatusMessage
          variant="empty"
          title="Nenhum repositório vinculado a este projeto."
          action={
            canManage && statusFilter !== 'ARCHIVED' ? (
              <button type="button" className={styles.newButton} onClick={openCreateForm}>
                <Plus size={16} aria-hidden="true" />
                Adicionar repositório
              </button>
            ) : undefined
          }
        />
      ) : null}

      {!isLoading && !isListError && items.length > 0 ? (
        <div className={styles.list}>
          {items.map((repository) => (
            <RepositoryRow
              key={repository.id}
              repository={repository}
              canManage={canManage}
              onEdit={() => openEditForm(repository)}
              onArchive={() => setArchiveTarget(repository)}
              onReactivate={() => reactivateMutation.mutate(repository.id)}
            />
          ))}
        </div>
      ) : null}

      <RepositoryFormDialog
        mode={formState?.mode ?? 'create'}
        open={formState !== null}
        repository={formState?.mode === 'edit' ? formState.repository : null}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        errorMessage={formError}
        onSubmit={handleFormSubmit}
        onClose={closeForm}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title={`Arquivar o repositório ${archiveTarget?.name ?? ''}?`}
        description="Ele deixará de ser utilizado em novas operações, mas seu histórico será preservado."
        confirmLabel="Arquivar"
        isConfirming={archiveMutation.isPending}
        onConfirm={() => {
          if (archiveTarget) {
            archiveMutation.mutate(archiveTarget.id)
          }
        }}
        onCancel={() => setArchiveTarget(null)}
      />
    </section>
  )
}
