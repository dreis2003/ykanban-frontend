import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { cardAssigneeApi } from '@/features/card/api/cardAssigneeApi'
import type { Card, CardAssigneeSummary } from '@/features/card/types'
import { userApi } from '@/features/user/api/userApi'
import { UserAvatar } from '@/features/user/components/UserAvatar/UserAvatar'
import { ApiError } from '@/shared/api/apiError'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import styles from './CardAssigneeSection.module.css'

interface Props {
  cardId: string
  projectId: string
  assignee: CardAssigneeSummary | null
  canManage: boolean
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? error.message
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}

/**
 * Auto-contida como CardLabelsSection: aplica optimistic update/rollback direto no cache
 * ['card', cardId] e invalida ['cards', projectId] ao final, para o avatar do KanbanCard no board
 * não ficar desatualizado. "Atribuir a mim" reutiliza o mesmo endpoint de atribuição — nenhuma
 * regra nova no backend (ver Prompt 12).
 */
export function CardAssigneeSection({ cardId, projectId, assignee, canManage }: Props) {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search, 300)

  const queryKey = ['card', cardId] as const

  const { data: usersPage, isFetching } = useQuery({
    queryKey: ['users', 'assignable', debouncedSearch],
    queryFn: () =>
      userApi.list({ status: 'ACTIVE', size: 10, ...(debouncedSearch ? { search: debouncedSearch } : {}) }),
    enabled: canManage && pickerOpen,
  })

  useEffect(() => {
    if (!pickerOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closePicker()
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePicker()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pickerOpen])

  function patchCardAssignee(nextAssignee: CardAssigneeSummary | null) {
    queryClient.setQueryData<Card>(queryKey, (current) => (current ? { ...current, assignee: nextAssignee } : current))
  }

  function invalidateCardsList() {
    return queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
  }

  const assignMutation = useMutation({
    mutationFn: (userId: string) => cardAssigneeApi.assign(cardId, userId),
    onSuccess: (updated) => {
      patchCardAssignee(updated.assignee)
      setError(null)
      closePicker()
    },
    onError: (err: unknown) => setError(errorMessageFrom(err)),
    onSettled: invalidateCardsList,
  })

  const unassignMutation = useMutation({
    mutationFn: () => cardAssigneeApi.unassign(cardId),
    onMutate: () => {
      const previous = queryClient.getQueryData<Card>(queryKey)
      patchCardAssignee(null)
      setError(null)
      return { previous }
    },
    onError: (err: unknown, _void, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      setError(errorMessageFrom(err))
    },
    onSettled: invalidateCardsList,
  })

  function closePicker() {
    setPickerOpen(false)
    setSearch('')
  }

  const isCurrentUserAssignee = Boolean(currentUser && assignee?.id === currentUser.id)
  const availableUsers = (usersPage?.content ?? []).filter((candidate) => candidate.id !== assignee?.id)

  return (
    <section className={styles.section} ref={containerRef}>
      <h3 className={styles.title}>Responsável</h3>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {assignee ? (
        <div className={styles.current}>
          <UserAvatar id={assignee.id} name={assignee.name} status={assignee.status} />
          <div className={styles.currentInfo}>
            <span className={styles.currentName}>{assignee.name}</span>
            {assignee.status === 'INACTIVE' ? <span className={styles.inactiveTag}>Inativo</span> : null}
          </div>
        </div>
      ) : (
        <span className={styles.emptyState}>Sem responsável</span>
      )}

      {canManage ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => setPickerOpen((current) => !current)}
            aria-expanded={pickerOpen}
          >
            {assignee ? 'Trocar responsável' : 'Atribuir responsável'}
          </button>
          {currentUser && !isCurrentUserAssignee ? (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => assignMutation.mutate(currentUser.id)}
            >
              Atribuir a mim
            </button>
          ) : null}
          {assignee ? (
            <button type="button" className={styles.actionButton} onClick={() => unassignMutation.mutate()}>
              Remover responsável
            </button>
          ) : null}
        </div>
      ) : null}

      {pickerOpen ? (
        <div className={styles.picker} role="dialog" aria-label="Selecionar responsável">
          <input
            className={styles.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            aria-label="Buscar usuário"
            autoFocus
          />
          <ul className={styles.options}>
            {availableUsers.map((candidate) => (
              <li key={candidate.id}>
                <button type="button" className={styles.option} onClick={() => assignMutation.mutate(candidate.id)}>
                  <UserAvatar id={candidate.id} name={candidate.name} />
                  {candidate.name}
                </button>
              </li>
            ))}
            {!isFetching && availableUsers.length === 0 ? (
              <li className={styles.noOptions}>Nenhum usuário encontrado.</li>
            ) : null}
          </ul>
          <button type="button" className={styles.closePicker} onClick={closePicker}>
            Fechar
          </button>
        </div>
      ) : null}
    </section>
  )
}
