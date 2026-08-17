import { useCallback, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { plansApi } from '@/features/plans/api/plansApi'
import type { ListPlansParams, PlanSortOption, PlanStatus } from '@/features/plans/types'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './PlansTable.module.css'

const SEARCH_DEBOUNCE_MS = 300

type StatusFilter = PlanStatus | 'ALL'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'INACTIVE', label: 'Inativos' },
]

const DEFAULT_SORT: PlanSortOption = 'name,asc'

const SORT_OPTIONS: { value: PlanSortOption; label: string }[] = [
  { value: 'name,asc', label: 'Nome A-Z' },
  { value: 'name,desc', label: 'Nome Z-A' },
  { value: 'code,asc', label: 'Código' },
  { value: 'createdAt,desc', label: 'Criados recentemente' },
]

const STATUS_LABELS: Record<PlanStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
}

function isStatusFilter(value: string | null): value is StatusFilter {
  return value === 'ACTIVE' || value === 'INACTIVE' || value === 'ALL'
}

function isSortOption(value: string | null): value is PlanSortOption {
  return SORT_OPTIONS.some((option) => option.value === value)
}

interface Props {
  onCreatePlan: () => void
}

/** Listagem/gestão do catálogo de Planos pela plataforma SaaS (ver ADR 0025) — cache TanStack Query
 * sob a chave `['platform', 'plans', ...]`, nunca compartilhada com `['platform', 'tenants', ...]`. */
export function PlansTable({ onCreatePlan }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFilter: StatusFilter = isStatusFilter(searchParams.get('status'))
    ? (searchParams.get('status') as StatusFilter)
    : 'ALL'
  const sort: PlanSortOption = isSortOption(searchParams.get('sort')) ? (searchParams.get('sort') as PlanSortOption) : DEFAULT_SORT
  const page = Number(searchParams.get('page') ?? '0') || 0
  const urlSearch = searchParams.get('search') ?? ''

  const [searchInput, setSearchInput] = useState(urlSearch)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const listParams: ListPlansParams = {
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(urlSearch ? { search: urlSearch } : {}),
    page,
    sort,
  }

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['platform', 'plans', 'list', listParams],
    queryFn: () => plansApi.list(listParams),
    placeholderData: keepPreviousData,
  })

  function clearFilters() {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    setSearchInput('')
    updateParams({ status: null, search: null, page: null })
  }

  const plans = data?.content ?? []

  return (
    <div className={styles.panel}>
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
              placeholder="Buscar por nome ou código..."
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

          <button type="button" className={styles.pageButton} onClick={onCreatePlan}>
            Novo plano
          </button>
        </div>
      </div>

      {isLoading ? <StatusMessage variant="loading" title="Carregando planos…" /> : null}

      {isError ? <StatusMessage variant="error" title="Não foi possível carregar os planos." /> : null}

      {!isLoading && !isError && plans.length === 0 ? (
        <StatusMessage
          variant="empty"
          title="Nenhum plano encontrado"
          description="Tente ajustar a pesquisa ou os filtros."
          action={
            <button type="button" className={styles.pageButton} onClick={clearFilters}>
              Limpar filtros
            </button>
          }
        />
      ) : null}

      {!isLoading && !isError && plans.length > 0 ? (
        <>
          <div className={styles.tableWrapper} data-fetching={isFetching}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Código</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ordem</th>
                  <th scope="col">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <Link to={ROUTES.platformPlanDetail(plan.id)} className={styles.planLink}>
                        {plan.name}
                      </Link>
                    </td>
                    <td>{plan.code}</td>
                    <td>
                      <span className={styles.statusBadge} data-status={plan.status}>
                        {STATUS_LABELS[plan.status]}
                      </span>
                    </td>
                    <td>{plan.displayOrder}</td>
                    <td>{new Date(plan.createdAt).toLocaleDateString('pt-BR')}</td>
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
    </div>
  )
}
