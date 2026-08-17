import { useCallback, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@/app/router/routes'
import { useAuth } from '@/features/auth/AuthContext'
import type { MembershipRole } from '@/features/auth/types'
import { ChangeRoleDialog } from '@/features/members/components/ChangeRoleDialog/ChangeRoleDialog'
import { membersApi } from '@/features/members/api/membersApi'
import type { ListMembersParams, Member, MemberSortOption, MemberStatus } from '@/features/members/types'
import { ApiError } from '@/shared/api/apiError'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog'
import { StatusMessage } from '@/shared/components/StatusMessage/StatusMessage'
import styles from './MembersPage.module.css'

const SEARCH_DEBOUNCE_MS = 300

type StatusFilter = MemberStatus | 'ALL'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'INACTIVE', label: 'Inativos' },
  { value: 'REMOVED', label: 'Removidos' },
  { value: 'ALL', label: 'Todos' },
]

const DEFAULT_SORT: MemberSortOption = 'name,asc'

const SORT_OPTIONS: { value: MemberSortOption; label: string }[] = [
  { value: 'name,asc', label: 'Nome A-Z' },
  { value: 'name,desc', label: 'Nome Z-A' },
  { value: 'email,asc', label: 'E-mail' },
  { value: 'role,asc', label: 'Papel' },
  { value: 'createdAt,desc', label: 'Entrou recentemente' },
]

const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Administrador',
  PROJECT_MANAGER: 'Gerente de Projetos',
  DEVELOPER: 'Desenvolvedor',
  VIEWER: 'Visualizador',
}

const STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  REMOVED: 'Removido',
}

function isStatusFilter(value: string | null): value is StatusFilter {
  return value === 'ACTIVE' || value === 'INACTIVE' || value === 'REMOVED' || value === 'ALL'
}

function isRoleFilter(value: string | null): value is MembershipRole {
  return value === 'ADMIN' || value === 'PROJECT_MANAGER' || value === 'DEVELOPER' || value === 'VIEWER'
}

function isSortOption(value: string | null): value is MemberSortOption {
  return SORT_OPTIONS.some((option) => option.value === value)
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

type ConfirmAction = { type: 'deactivate' | 'remove'; member: Member }

export function MembersPage() {
  const { user, membershipRole, refreshSession } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFilter: StatusFilter = isStatusFilter(searchParams.get('status'))
    ? (searchParams.get('status') as StatusFilter)
    : 'ACTIVE'
  const roleFilter: MembershipRole | null = isRoleFilter(searchParams.get('role'))
    ? (searchParams.get('role') as MembershipRole)
    : null
  const sort: MemberSortOption = isSortOption(searchParams.get('sort'))
    ? (searchParams.get('sort') as MemberSortOption)
    : DEFAULT_SORT
  const page = Number(searchParams.get('page') ?? '0') || 0
  const urlSearch = searchParams.get('search') ?? ''

  const [searchInput, setSearchInput] = useState(urlSearch)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [roleDialogMember, setRoleDialogMember] = useState<Member | null>(null)
  const [roleDialogError, setRoleDialogError] = useState<string | null>(null)
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
      updateParams({ search: value || null, page: null })
    }, SEARCH_DEBOUNCE_MS)
  }

  const listParams: ListMembersParams = {
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(urlSearch ? { search: urlSearch } : {}),
    page,
    sort,
  }

  const {
    data,
    isLoading,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ['members', 'list', listParams],
    queryFn: () => membersApi.list(listParams),
    placeholderData: keepPreviousData,
  })

  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ['members'] })

  /** Role/Membership nunca vêm do JWT (ver ADR 0020) — uma mutação que o próprio usuário aplica
   * sobre si mesmo só reflete na UI (nav, permissões) depois de resincronizar /auth/me. Se a
   * Membership deixou de ser ACTIVE (auto-desativação/remoção), não há mais Tenant ativo: sai da
   * tela antes que outra chamada tope em 403. */
  const handleSelfMutationSideEffect = useCallback(
    async (member: Member) => {
      if (member.userId !== user?.id) {
        return
      }
      const context = await refreshSession()
      if (context === 'TENANT_SELECTION') {
        navigate(ROUTES.selectOrganization)
      }
    },
    [user, refreshSession, navigate],
  )

  const changeRoleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: MembershipRole }) =>
      membersApi.changeRole(membershipId, role),
    onSuccess: async (updated) => {
      invalidateMembers()
      setRoleDialogMember(null)
      setRoleDialogError(null)
      await handleSelfMutationSideEffect(updated)
    },
    onError: (error: unknown) => setRoleDialogError(errorMessageFrom(error)),
  })

  const activateMutation = useMutation({
    mutationFn: (member: Member) => membersApi.activate(member.membershipId),
    onSuccess: async (updated) => {
      invalidateMembers()
      setActionError(null)
      await handleSelfMutationSideEffect(updated)
    },
    onError: (error: unknown) => setActionError(errorMessageFrom(error)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (member: Member) => membersApi.deactivate(member.membershipId),
    onSuccess: async (updated) => {
      invalidateMembers()
      setConfirmAction(null)
      setActionError(null)
      await handleSelfMutationSideEffect(updated)
    },
    onError: (error: unknown) => {
      setActionError(errorMessageFrom(error))
      setConfirmAction(null)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (member: Member) => membersApi.remove(member.membershipId),
    onSuccess: async (_, member) => {
      invalidateMembers()
      setConfirmAction(null)
      setActionError(null)
      await handleSelfMutationSideEffect(member)
    },
    onError: (error: unknown) => {
      setActionError(errorMessageFrom(error))
      setConfirmAction(null)
    },
  })

  function openRoleDialog(member: Member) {
    setRoleDialogError(null)
    setRoleDialogMember(member)
  }

  function closeRoleDialog() {
    setRoleDialogMember(null)
    setRoleDialogError(null)
  }

  function handleConfirm() {
    if (!confirmAction) return
    if (confirmAction.type === 'deactivate') {
      deactivateMutation.mutate(confirmAction.member)
    } else {
      removeMutation.mutate(confirmAction.member)
    }
  }

  function clearFilters() {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    setSearchInput('')
    updateParams({ status: 'ALL', role: null, search: null, page: null })
  }

  const members = data?.content ?? []
  const isConfirming = deactivateMutation.isPending || removeMutation.isPending

  // Segurança real é sempre validada no backend (todo endpoint de /members exige ADMIN) — isto só
  // evita o flash de uma tela que a pessoa não pode usar. Fica depois de todos os hooks (não antes
  // do primeiro return) porque `membershipRole` pode mudar em runtime — ex.: a própria pessoa se
  // autodegrada via ChangeRoleDialog — e um early-return antes dos hooks violaria as rules of hooks
  // ao pular chamadas entre renders.
  if (membershipRole !== 'ADMIN') {
    return <Navigate to={ROUTES.projects} replace />
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Membros</h1>
          <p className={styles.subtitle}>Gerencie papéis e acesso dos membros da organização</p>
        </div>
      </header>

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
              placeholder="Buscar por nome ou e-mail..."
              value={searchInput}
              onChange={(event) => handleSearchInputChange(event.target.value)}
            />
          </label>

          <label className={styles.select}>
            Papel
            <select
              value={roleFilter ?? ''}
              onChange={(event) => updateParams({ role: event.target.value || null, page: null })}
            >
              <option value="">Todos</option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
        </div>
      </div>

      {isLoading ? <StatusMessage variant="loading" title="Carregando membros…" /> : null}

      {isError ? <StatusMessage variant="error" title="Não foi possível carregar os membros." /> : null}

      {!isLoading && !isError && members.length === 0 ? (
        <StatusMessage
          variant="empty"
          title="Nenhum membro encontrado"
          description="Tente ajustar a pesquisa ou os filtros."
          action={
            <button type="button" className={styles.pageButton} onClick={clearFilters}>
              Limpar filtros
            </button>
          }
        />
      ) : null}

      {!isLoading && !isError && members.length > 0 ? (
        <>
          <div className={styles.tableWrapper} data-fetching={isFetching}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Papel</th>
                  <th scope="col">Status</th>
                  <th scope="col">Entrou em</th>
                  <th scope="col">
                    <span className={styles.srOnly}>Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.userId === user?.id
                  const isRemoved = member.status === 'REMOVED'
                  return (
                    <tr key={member.membershipId}>
                      <td>
                        {member.name}
                        {isSelf ? <span className={styles.selfTag}>você</span> : null}
                      </td>
                      <td>{member.email}</td>
                      <td>{ROLE_LABELS[member.role]}</td>
                      <td>
                        <span className={styles.statusBadge} data-status={member.status}>
                          {STATUS_LABELS[member.status]}
                        </span>
                      </td>
                      <td>{new Date(member.joinedAt).toLocaleDateString('pt-BR')}</td>
                      <td className={styles.actionsCell}>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => openRoleDialog(member)}
                          disabled={isRemoved}
                        >
                          Alterar papel
                        </button>
                        {member.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => setConfirmAction({ type: 'deactivate', member })}
                          >
                            Desativar
                          </button>
                        ) : member.status === 'INACTIVE' ? (
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => activateMutation.mutate(member)}
                            disabled={activateMutation.isPending}
                          >
                            Ativar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={styles.actionButtonDanger}
                          onClick={() => setConfirmAction({ type: 'remove', member })}
                          disabled={isRemoved}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  )
                })}
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

      <ChangeRoleDialog
        open={roleDialogMember !== null}
        member={roleDialogMember}
        isSubmitting={changeRoleMutation.isPending}
        errorMessage={roleDialogError}
        onSubmit={(role) => {
          if (roleDialogMember) {
            changeRoleMutation.mutate({ membershipId: roleDialogMember.membershipId, role })
          }
        }}
        onClose={closeRoleDialog}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.type === 'deactivate'
            ? `Desativar ${confirmAction.member.name}?`
            : `Remover ${confirmAction?.member.name ?? ''}?`
        }
        description={
          confirmAction?.type === 'deactivate'
            ? 'A pessoa perde acesso a esta organização até ser reativada. O histórico de cards e comentários é preservado.'
            : 'A pessoa deixa de fazer parte desta organização. O histórico de cards e comentários é preservado — a conta e o acesso a outras organizações não são afetados.'
        }
        confirmLabel={confirmAction?.type === 'deactivate' ? 'Desativar' : 'Remover'}
        isConfirming={isConfirming}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </section>
  )
}
