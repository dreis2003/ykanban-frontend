import { useCallback, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { platformApi } from '@/features/platform/api/platformApi'
import type {
  ListPlatformTenantsParams,
  PlatformTenant,
  PlatformTenantSortOption,
  TenantStatus,
} from '@/features/platform/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './PlatformTenantsTable.module.css'

const SEARCH_DEBOUNCE_MS = 300

type StatusFilter = TenantStatus | 'ALL'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'SUSPENDED', label: 'Suspensas' },
]

const DEFAULT_SORT: PlatformTenantSortOption = 'name,asc'

const SORT_OPTIONS: { value: PlatformTenantSortOption; label: string }[] = [
  { value: 'name,asc', label: 'Nome A-Z' },
  { value: 'name,desc', label: 'Nome Z-A' },
  { value: 'slug,asc', label: 'Slug' },
  { value: 'createdAt,desc', label: 'Criadas recentemente' },
]

const STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
}

function isStatusFilter(value: string | null): value is StatusFilter {
  return value === 'ACTIVE' || value === 'SUSPENDED' || value === 'ALL'
}

function isSortOption(value: string | null): value is PlatformTenantSortOption {
  return SORT_OPTIONS.some((option) => option.value === value)
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

type ConfirmAction = { type: 'suspend' | 'activate'; tenant: PlatformTenant }

interface Props {
  onCreateTenant: () => void
}

export function PlatformTenantsTable({ onCreateTenant }: Props) {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFilter: StatusFilter = isStatusFilter(searchParams.get('status'))
    ? (searchParams.get('status') as StatusFilter)
    : 'ALL'
  const sort: PlatformTenantSortOption = isSortOption(searchParams.get('sort'))
    ? (searchParams.get('sort') as PlatformTenantSortOption)
    : DEFAULT_SORT
  const page = Number(searchParams.get('page') ?? '0') || 0
  const urlSearch = searchParams.get('search') ?? ''

  const [searchInput, setSearchInput] = useState(urlSearch)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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

  const listParams: ListPlatformTenantsParams = {
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(urlSearch ? { search: urlSearch } : {}),
    page,
    sort,
  }

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['platform', 'tenants', 'list', listParams],
    queryFn: () => platformApi.listTenants(listParams),
    placeholderData: keepPreviousData,
  })

  const invalidateTenants = () => queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] })

  const suspendMutation = useMutation({
    mutationFn: (tenant: PlatformTenant) => platformApi.suspendTenant(tenant.id),
    onSuccess: () => {
      invalidateTenants()
      setConfirmAction(null)
      setActionError(null)
    },
    onError: (error: unknown) => {
      setActionError(errorMessageFrom(error))
      setConfirmAction(null)
    },
  })

  const activateMutation = useMutation({
    mutationFn: (tenant: PlatformTenant) => platformApi.activateTenant(tenant.id),
    onSuccess: () => {
      invalidateTenants()
      setConfirmAction(null)
      setActionError(null)
    },
    onError: (error: unknown) => {
      setActionError(errorMessageFrom(error))
      setConfirmAction(null)
    },
  })

  function handleConfirm() {
    if (!confirmAction) return
    if (confirmAction.type === 'suspend') {
      suspendMutation.mutate(confirmAction.tenant)
    } else {
      activateMutation.mutate(confirmAction.tenant)
    }
  }

  function clearFilters() {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    setSearchInput('')
    updateParams({ status: null, search: null, page: null })
  }

  const tenants = data?.content ?? []
  const isConfirming = suspendMutation.isPending || activateMutation.isPending

  return (
    <div className={styles.panel}>
      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

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
              onClick={() => updateParams({ status: tab.value === 'ALL' ? null : tab.value, page: null })}
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
              placeholder="Buscar por nome ou slug..."
              value={searchInput}
              onChange={(event) => handleSearchInputChange(event.target.value)}
            />
          </label>

          <label className={styles.select}>
            Ordenar por
            <select
              value={sort}
              onChange={(event) =>
                updateParams({ sort: event.target.value === DEFAULT_SORT ? null : event.target.value, page: null })
              }
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className={styles.pageButton} onClick={onCreateTenant}>
            Nova organização
          </button>
        </div>
      </div>

      {isLoading ? <StatusMessage variant="loading" title="Carregando organizações…" /> : null}

      {isError ? <StatusMessage variant="error" title="Não foi possível carregar as organizações." /> : null}

      {!isLoading && !isError && tenants.length === 0 ? (
        <StatusMessage
          variant="empty"
          title="Nenhuma organização encontrada"
          description="Tente ajustar a pesquisa ou os filtros."
          action={
            <button type="button" className={styles.pageButton} onClick={clearFilters}>
              Limpar filtros
            </button>
          }
        />
      ) : null}

      {!isLoading && !isError && tenants.length > 0 ? (
        <>
          <div className={styles.tableWrapper} data-fetching={isFetching}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Slug</th>
                  <th scope="col">Status</th>
                  <th scope="col">Membros</th>
                  <th scope="col">Projetos</th>
                  <th scope="col">Criada em</th>
                  <th scope="col">
                    <span className={styles.srOnly}>Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <Link to={ROUTES.platformTenantDetail(tenant.id)} className={styles.tenantLink}>
                        {tenant.name}
                      </Link>
                    </td>
                    <td>{tenant.slug}</td>
                    <td>
                      <span className={styles.statusBadge} data-status={tenant.status}>
                        {STATUS_LABELS[tenant.status]}
                      </span>
                    </td>
                    <td>{tenant.memberCount}</td>
                    <td>{tenant.projectCount}</td>
                    <td>{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className={styles.actionsCell}>
                      {tenant.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          className={styles.actionButtonDanger}
                          onClick={() => setConfirmAction({ type: 'suspend', tenant })}
                        >
                          Suspender
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => setConfirmAction({ type: 'activate', tenant })}
                        >
                          Reativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.type === 'suspend'
            ? `Suspender ${confirmAction.tenant.name}?`
            : `Reativar ${confirmAction?.tenant.name ?? ''}?`
        }
        description={
          confirmAction?.type === 'suspend'
            ? 'Usuários da organização perdem acesso de escrita e novos convites não podem ser aceitos até a reativação. Leitura e dados existentes são preservados.'
            : 'A organização volta a operar normalmente — escrita liberada e convites pendentes podem voltar a ser aceitos.'
        }
        confirmLabel={confirmAction?.type === 'suspend' ? 'Suspender' : 'Reativar'}
        isConfirming={isConfirming}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
