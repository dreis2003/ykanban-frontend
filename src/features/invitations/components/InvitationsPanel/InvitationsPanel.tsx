import { useCallback, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { MembershipRole } from '@/features/auth/types'
import { invitationsApi } from '@/features/invitations/api/invitationsApi'
import type { Invitation, InvitationSortOption, InvitationStatus, ListInvitationsParams } from '@/features/invitations/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './InvitationsPanel.module.css'

const SEARCH_DEBOUNCE_MS = 300

type StatusFilter = InvitationStatus | 'ALL'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'ACCEPTED', label: 'Aceitos' },
  { value: 'REVOKED', label: 'Revogados' },
  { value: 'EXPIRED', label: 'Expirados' },
  { value: 'ALL', label: 'Todos' },
]

const DEFAULT_SORT: InvitationSortOption = 'createdAt,desc'

const SORT_OPTIONS: { value: InvitationSortOption; label: string }[] = [
  { value: 'createdAt,desc', label: 'Enviados recentemente' },
  { value: 'email,asc', label: 'E-mail' },
  { value: 'role,asc', label: 'Papel' },
  { value: 'expiresAt,asc', label: 'Expiram primeiro' },
]

const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Administrador',
  PROJECT_MANAGER: 'Gerente de Projetos',
  DEVELOPER: 'Desenvolvedor',
  VIEWER: 'Visualizador',
}

const STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceito',
  REVOKED: 'Revogado',
  EXPIRED: 'Expirado',
}

function isStatusFilter(value: string | null): value is StatusFilter {
  return value === 'PENDING' || value === 'ACCEPTED' || value === 'REVOKED' || value === 'EXPIRED' || value === 'ALL'
}

function isSortOption(value: string | null): value is InvitationSortOption {
  return SORT_OPTIONS.some((option) => option.value === value)
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

interface Props {
  active: boolean
  onSendNewInvite: (values: { email: string; role: MembershipRole }) => void
}

/** Tab "Convites" da administração de organização (ver ADR 0022, itens 107-113). Filtros/paginação
 * têm prefixo `inv` na URL para não colidir com os da tab "Usuários" (mesma página, mesmo
 * `useSearchParams`). */
export function InvitationsPanel({ active, onSendNewInvite }: Props) {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFilter: StatusFilter = isStatusFilter(searchParams.get('invStatus'))
    ? (searchParams.get('invStatus') as StatusFilter)
    : 'PENDING'
  const sort: InvitationSortOption = isSortOption(searchParams.get('invSort'))
    ? (searchParams.get('invSort') as InvitationSortOption)
    : DEFAULT_SORT
  const page = Number(searchParams.get('invPage') ?? '0') || 0
  const urlSearch = searchParams.get('invSearch') ?? ''

  const [searchInput, setSearchInput] = useState(urlSearch)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null)
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

  const [lastUrlSearch, setLastUrlSearch] = useState(urlSearch)
  if (lastUrlSearch !== urlSearch) {
    setLastUrlSearch(urlSearch)
    setSearchInput(urlSearch)
  }

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
      updateParams({ invSearch: value || null, invPage: null })
    }, SEARCH_DEBOUNCE_MS)
  }

  const listParams: ListInvitationsParams = {
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(urlSearch ? { search: urlSearch } : {}),
    page,
    sort,
  }

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['invitations', 'list', listParams],
    queryFn: () => invitationsApi.list(listParams),
    placeholderData: keepPreviousData,
    enabled: active,
  })

  const invalidateInvitations = () => queryClient.invalidateQueries({ queryKey: ['invitations'] })

  const resendMutation = useMutation({
    mutationFn: (invitation: Invitation) => invitationsApi.resend(invitation.id),
    onSuccess: () => {
      invalidateInvitations()
      setActionError(null)
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
  })

  const revokeMutation = useMutation({
    mutationFn: (invitation: Invitation) => invitationsApi.revoke(invitation.id),
    onSuccess: () => {
      invalidateInvitations()
      setRevokeTarget(null)
      setActionError(null)
    },
    onError: (error: unknown) => {
      setActionError(errorMessageFrom(error))
      setRevokeTarget(null)
    },
  })

  function clearFilters() {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    setSearchInput('')
    updateParams({ invStatus: 'ALL', invSearch: null, invPage: null })
  }

  const invitations = data?.content ?? []

  return (
    <div className={styles.panel}>
      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.filters} role="tablist" aria-label="Filtrar convites por status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.value}
              className={styles.filterButton}
              data-active={statusFilter === tab.value}
              onClick={() => updateParams({ invStatus: tab.value, invPage: null })}
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
              placeholder="Buscar por e-mail..."
              value={searchInput}
              onChange={(event) => handleSearchInputChange(event.target.value)}
            />
          </label>

          <label className={styles.select}>
            Ordenar por
            <select
              value={sort}
              onChange={(event) =>
                updateParams({ invSort: event.target.value === DEFAULT_SORT ? null : event.target.value, invPage: null })
              }
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

      {isLoading ? <StatusMessage variant="loading" title="Carregando convites…" /> : null}

      {isError ? <StatusMessage variant="error" title="Não foi possível carregar os convites." /> : null}

      {!isLoading && !isError && invitations.length === 0 ? (
        <StatusMessage
          variant="empty"
          title="Nenhum convite encontrado"
          description="Tente ajustar a pesquisa ou os filtros."
          action={
            <button type="button" className={styles.pageButton} onClick={clearFilters}>
              Limpar filtros
            </button>
          }
        />
      ) : null}

      {!isLoading && !isError && invitations.length > 0 ? (
        <>
          <div className={styles.tableWrapper} data-fetching={isFetching}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">E-mail</th>
                  <th scope="col">Função</th>
                  <th scope="col">Status</th>
                  <th scope="col">Enviado por</th>
                  <th scope="col">Enviado em</th>
                  <th scope="col">Expira em</th>
                  <th scope="col">
                    <span className={styles.srOnly}>Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>{invitation.email}</td>
                    <td>{ROLE_LABELS[invitation.role]}</td>
                    <td>
                      <span className={styles.statusBadge} data-status={invitation.status}>
                        {STATUS_LABELS[invitation.status]}
                      </span>
                    </td>
                    <td>{invitation.invitedBy.name}</td>
                    <td>{new Date(invitation.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td>{new Date(invitation.expiresAt).toLocaleDateString('pt-BR')}</td>
                    <td className={styles.actionsCell}>
                      {invitation.status === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => resendMutation.mutate(invitation)}
                            disabled={resendMutation.isPending}
                          >
                            Reenviar
                          </button>
                          <button
                            type="button"
                            className={styles.actionButtonDanger}
                            onClick={() => setRevokeTarget(invitation)}
                          >
                            Revogar
                          </button>
                        </>
                      ) : invitation.status === 'EXPIRED' ? (
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => onSendNewInvite({ email: invitation.email, role: invitation.role })}
                        >
                          Enviar novo convite
                        </button>
                      ) : null}
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
                onClick={() => updateParams({ invPage: String(page - 1) })}
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
                onClick={() => updateParams({ invPage: String(page + 1) })}
              >
                Próxima
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={revokeTarget !== null}
        title={`Revogar convite de ${revokeTarget?.email ?? ''}?`}
        description="O link enviado por e-mail deixa de funcionar imediatamente. É possível convidar este e-mail novamente depois."
        confirmLabel="Revogar"
        isConfirming={revokeMutation.isPending}
        onConfirm={() => {
          if (revokeTarget) {
            revokeMutation.mutate(revokeTarget)
          }
        }}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  )
}
