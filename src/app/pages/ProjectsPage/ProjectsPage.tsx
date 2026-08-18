import { useCallback, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { entitlementsApi } from '@/features/entitlements/api/entitlementsApi'
import { projectsApi } from '@/features/projects/api/projectsApi'
import { ProjectCard } from '@/features/projects/components/ProjectCard/ProjectCard'
import { ProjectFormDialog } from '@/features/projects/components/ProjectFormDialog/ProjectFormDialog'
import { ProjectsSummary } from '@/features/projects/components/ProjectsSummary/ProjectsSummary'
import type { ListProjectsParams, Project, ProjectSortOption, UpdateProjectRequest } from '@/features/projects/types'
import { useAuth } from '@/features/auth/AuthContext'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './ProjectsPage.module.css'

const SEARCH_DEBOUNCE_MS = 300

type StatusFilter = 'ACTIVE' | 'ARCHIVED' | 'ALL'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'ARCHIVED', label: 'Arquivados' },
  { value: 'ALL', label: 'Todos' },
]

const DEFAULT_SORT: ProjectSortOption = 'name,asc'

const SORT_OPTIONS: { value: ProjectSortOption; label: string }[] = [
  { value: 'name,asc', label: 'Nome A-Z' },
  { value: 'name,desc', label: 'Nome Z-A' },
  { value: 'createdAt,desc', label: 'Mais recentes' },
  { value: 'updatedAt,desc', label: 'Atualizados recentemente' },
  { value: 'code,asc', label: 'Código' },
]

function isStatusFilter(value: string | null): value is StatusFilter {
  return value === 'ACTIVE' || value === 'ARCHIVED' || value === 'ALL'
}

function isSortOption(value: string | null): value is ProjectSortOption {
  return SORT_OPTIONS.some((option) => option.value === value)
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

type FormState = { mode: 'create' } | { mode: 'edit'; project: Project }

export function ProjectsPage() {
  const { membershipRole, activeTenant } = useAuth()
  const canManage = membershipRole === 'ADMIN' || membershipRole === 'PROJECT_MANAGER'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: entitlements } = useQuery({
    queryKey: ['entitlements', activeTenant?.id],
    queryFn: entitlementsApi.current,
    enabled: Boolean(activeTenant),
  })
  const projectLimit = entitlements?.limits?.MAX_PROJECTS
  const canCreateProject = !projectLimit || projectLimit.state === 'AVAILABLE' || projectLimit.state === 'UNLIMITED'

  // A URL é a fonte da verdade para status/página/ordenação — permite refresh, back/forward e
  // compartilhar o link com os filtros aplicados (busca é sincronizada via debounce, ver abaixo).
  const statusFilter: StatusFilter = isStatusFilter(searchParams.get('status'))
    ? (searchParams.get('status') as StatusFilter)
    : 'ACTIVE'
  const sort: ProjectSortOption = isSortOption(searchParams.get('sort'))
    ? (searchParams.get('sort') as ProjectSortOption)
    : DEFAULT_SORT
  const page = Number(searchParams.get('page') ?? '0') || 0
  const urlSearch = searchParams.get('search') ?? ''

  const [searchInput, setSearchInput] = useState(urlSearch)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [formState, setFormState] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null)

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === null) {
              next.delete(key)
            } else {
              next.set(key, value)
            }
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  // Mantém o input de busca alinhado quando a URL muda por uma via que não seja a digitação local
  // (navegação back/forward ou o botão "Limpar filtros"). Ajuste de estado durante o render, não em
  // useEffect (mesmo padrão já usado neste arquivo antes).
  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch)
  if (lastUrlSearch !== urlSearch) {
    setLastUrlSearch(urlSearch)
    setSearchInput(urlSearch)
  }

  // Cancela qualquer debounce pendente sempre que a URL muda (por nós ou externamente, ex.:
  // back/forward, "Limpar filtros") — senão ele reaplicaria o texto antigo na URL depois. Acesso a
  // ref fica isolado no efeito (nunca durante o render, ver regra react-hooks/refs).
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
  }, [urlSearch])

  useEffect(
    () => () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    },
    [],
  )

  function handleSearchInputChange(value: string) {
    setSearchInput(value)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      updateParams({ search: value || null, page: null })
    }, SEARCH_DEBOUNCE_MS)
  }

  const listParams: ListProjectsParams = {
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(urlSearch ? { search: urlSearch } : {}),
    page,
    sort,
  }

  const {
    data,
    isLoading: isListLoading,
    isFetching: isListFetching,
    isError: isListError,
  } = useQuery({
    queryKey: ['projects', 'list', listParams],
    queryFn: () => projectsApi.list(listParams),
    placeholderData: keepPreviousData,
  })

  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
  } = useQuery({
    queryKey: ['projects', 'summary'],
    queryFn: projectsApi.summary,
  })

  const isLoading = isListLoading || isSummaryLoading
  const isError = isListError || isSummaryError

  // Criar/arquivar/reativar Project muda o uso de MAX_PROJECTS (ver ADR 0026, item 265) — nunca
  // deixa a UI mostrando capacidade desatualizada depois dessas ações.
  const invalidateProjects = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['entitlements'] })
  }

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      invalidateProjects()
      setFormState(null)
      setFormError(null)
    },
    onError: (error: unknown) => setFormError(errorMessageFrom(error)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectRequest }) =>
      projectsApi.update(id, payload),
    onSuccess: () => {
      invalidateProjects()
      setFormState(null)
      setFormError(null)
    },
    onError: (error: unknown) => setFormError(errorMessageFrom(error)),
  })

  const archiveMutation = useMutation({
    mutationFn: projectsApi.archive,
    onSuccess: () => {
      invalidateProjects()
      setArchiveTarget(null)
    },
  })

  const activateMutation = useMutation({
    mutationFn: projectsApi.activate,
    onSuccess: invalidateProjects,
  })

  function openCreateForm() {
    setFormError(null)
    setFormState({ mode: 'create' })
  }

  function openEditForm(project: Project) {
    setFormError(null)
    setFormState({ mode: 'edit', project })
  }

  function closeForm() {
    setFormState(null)
    setFormError(null)
  }

  function handleFormSubmit(values: { code?: string; name: string; description: string }) {
    if (formState?.mode === 'create') {
      createMutation.mutate({
        code: values.code ?? '',
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
      })
    } else if (formState?.mode === 'edit') {
      updateMutation.mutate({
        id: formState.project.id,
        payload: { name: values.name, ...(values.description ? { description: values.description } : {}) },
      })
    }
  }

  function clearFilters() {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    setSearchInput('')
    updateParams({ status: 'ALL', search: null, page: null })
  }

  const projects = data?.content ?? []
  const noProjectsAtAll = summary?.total === 0

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Projetos</h1>
          <p className={styles.subtitle}>Gerencie os projetos da Yakuza Studio</p>
          {projectLimit && projectLimit.mode !== 'UNLIMITED' ? (
            <p className={styles.capacityHint} data-state={projectLimit.state}>
              {projectLimit.usage} de {projectLimit.value} projetos do plano em uso
            </p>
          ) : null}
        </div>
        {canManage ? (
          <button
            type="button"
            className={styles.newProjectButton}
            onClick={openCreateForm}
            disabled={!canCreateProject}
            title={canCreateProject ? undefined : 'Limite de projetos do plano atingido.'}
          >
            <Plus size={16} aria-hidden="true" />
            Novo Projeto
          </button>
        ) : null}
      </header>

      {summary ? <ProjectsSummary summary={summary} /> : null}

      <div className={styles.toolbar}>
        <div className={styles.filters} role="tablist" aria-label="Filtrar por status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.value}
              className={styles.filterButton}
              data-active={statusFilter === tab.value}
              onClick={() => updateParams({ status: tab.value, page: null })}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.toolbarActions}>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar projetos..."
              value={searchInput}
              onChange={(event) => handleSearchInputChange(event.target.value)}
            />
          </label>

          <label className={styles.sort}>
            Ordenar por
            <select
              value={sort}
              onChange={(event) => updateParams({ sort: event.target.value === DEFAULT_SORT ? null : event.target.value, page: null })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading ? <StatusMessage variant="loading" title="Carregando projetos…" /> : null}

      {isError ? (
        <StatusMessage variant="error" title="Não foi possível carregar os projetos." />
      ) : null}

      {!isLoading && !isError && projects.length === 0 ? (
        noProjectsAtAll ? (
          <StatusMessage
            variant="empty"
            title="Nenhum projeto cadastrado"
            description={
              canManage
                ? 'Crie o primeiro projeto da Yakuza Studio.'
                : 'Nenhum projeto está disponível no momento.'
            }
            action={
              canManage ? (
                <button
                  type="button"
                  className={styles.newProjectButton}
                  onClick={openCreateForm}
                  disabled={!canCreateProject}
                  title={canCreateProject ? undefined : 'Limite de projetos do plano atingido.'}
                >
                  <Plus size={16} aria-hidden="true" />
                  Criar projeto
                </button>
              ) : undefined
            }
          />
        ) : (
          <StatusMessage
            variant="empty"
            title="Nenhum projeto encontrado para sua pesquisa."
            description="Tente ajustar a pesquisa ou os filtros."
            action={
              <button type="button" className={styles.pageButton} onClick={clearFilters}>
                Limpar filtros
              </button>
            }
          />
        )
      ) : null}

      {!isLoading && !isError && projects.length > 0 ? (
        <>
          <div className={styles.grid} data-fetching={isListFetching}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                canManage={canManage}
                onEdit={() => openEditForm(project)}
                onArchive={() => setArchiveTarget(project)}
                onActivate={() => activateMutation.mutate(project.id)}
              />
            ))}
          </div>

          {data && data.totalPages > 1 ? (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageButton}
                disabled={page === 0}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                Anterior
              </button>
              <span className={styles.pageInfo}>
                Página {page + 1} de {data.totalPages}
              </span>
              <button
                type="button"
                className={styles.pageButton}
                disabled={page + 1 >= data.totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Próxima
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <ProjectFormDialog
        mode={formState?.mode ?? 'create'}
        open={formState !== null}
        project={formState?.mode === 'edit' ? formState.project : null}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        errorMessage={formError}
        onSubmit={handleFormSubmit}
        onClose={closeForm}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        title={`Arquivar ${archiveTarget?.name ?? ''}?`}
        description="O projeto deixará de aparecer entre os projetos ativos, mas seus dados serão preservados."
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
