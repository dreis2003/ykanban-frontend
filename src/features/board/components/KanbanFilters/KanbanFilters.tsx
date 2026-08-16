import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useBoardFilters } from '@/features/board/hooks/useBoardFilters'
import type { CardPriority, CardType } from '@/features/card/types'
import { labelApi } from '@/features/label/api/labelApi'
import { userApi } from '@/features/user/api/userApi'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import styles from './KanbanFilters.module.css'

interface Props {
  projectId: string
}

const TYPE_LABELS: Record<CardType, string> = {
  FEATURE: 'Feature',
  BUG: 'Bug',
  REFACTOR: 'Refactor',
  TECH: 'Técnico',
  SPIKE: 'Spike',
}

const PRIORITY_LABELS: Record<CardPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const ALL_TYPES = Object.keys(TYPE_LABELS) as CardType[]
const ALL_PRIORITIES = Object.keys(PRIORITY_LABELS) as CardPriority[]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/**
 * Filtros combinam com AND entre categorias e OR dentro de cada categoria (ver ADR 0016). Estado
 * vive na URL via {@link useBoardFilters} — este componente só lê/escreve nela, nunca guarda o
 * filtro em estado local (exceto o texto de busca, para o debounce não disparar navegação a cada
 * tecla).
 */
export function KanbanFilters({ projectId }: Props) {
  const { state, hasActiveFilters, update, clearAll } = useBoardFilters()
  const [searchInput, setSearchInput] = useState(state.search)
  // Sincroniza o input local quando a URL muda por fora (voltar/avançar do navegador, "Limpar
  // filtros") sem depender de um efeito — ajuste de estado durante a renderização, não em reação a
  // ela (ver https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [lastSyncedSearch, setLastSyncedSearch] = useState(state.search)
  if (state.search !== lastSyncedSearch) {
    setLastSyncedSearch(state.search)
    setSearchInput(state.search)
  }
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  useEffect(() => {
    if (debouncedSearch !== state.search) {
      update({ search: debouncedSearch })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve disparar quando o valor debounced muda
  }, [debouncedSearch])

  const { data: labels } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelApi.list(projectId),
  })

  const { data: usersPage } = useQuery({
    queryKey: ['users', 'board-filter'],
    queryFn: () => userApi.list({ status: 'ACTIVE', size: 100 }),
  })

  const users = usersPage?.content ?? []
  const selectedAssignee = state.assigneeId ? users.find((candidate) => candidate.id === state.assigneeId) : undefined

  function clearSearch() {
    setSearchInput('')
    update({ search: '' })
  }

  return (
    <div className={styles.wrapper} role="search" aria-label="Filtros do Kanban">
      <div className={styles.row}>
        <div className={styles.searchBox}>
          <input
            type="search"
            className={styles.searchInput}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar por chave, título ou descrição…"
            aria-label="Buscar cards"
          />
        </div>

        <details className={styles.dropdown}>
          <summary className={styles.summary}>Tipo{state.types.length ? ` (${state.types.length})` : ''}</summary>
          <div className={styles.menu} role="group" aria-label="Filtrar por tipo">
            {ALL_TYPES.map((type) => (
              <label key={type} className={styles.option}>
                <input
                  type="checkbox"
                  checked={state.types.includes(type)}
                  onChange={() => update({ types: toggle(state.types, type) })}
                />
                {TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </details>

        <details className={styles.dropdown}>
          <summary className={styles.summary}>
            Prioridade{state.priorities.length ? ` (${state.priorities.length})` : ''}
          </summary>
          <div className={styles.menu} role="group" aria-label="Filtrar por prioridade">
            {ALL_PRIORITIES.map((priority) => (
              <label key={priority} className={styles.option}>
                <input
                  type="checkbox"
                  checked={state.priorities.includes(priority)}
                  onChange={() => update({ priorities: toggle(state.priorities, priority) })}
                />
                {PRIORITY_LABELS[priority]}
              </label>
            ))}
          </div>
        </details>

        {labels && labels.length > 0 ? (
          <details className={styles.dropdown}>
            <summary className={styles.summary}>Labels{state.labelIds.length ? ` (${state.labelIds.length})` : ''}</summary>
            <div className={styles.menu} role="group" aria-label="Filtrar por label">
              {labels.map((label) => (
                <label key={label.id} className={styles.option}>
                  <input
                    type="checkbox"
                    checked={state.labelIds.includes(label.id)}
                    onChange={() => update({ labelIds: toggle(state.labelIds, label.id) })}
                  />
                  {label.name}
                </label>
              ))}
            </div>
          </details>
        ) : null}

        <details className={styles.dropdown}>
          <summary className={styles.summary}>
            Responsável{state.unassigned ? ' (Não atribuído)' : selectedAssignee ? ` (${selectedAssignee.name})` : ''}
          </summary>
          <div className={styles.menu} role="group" aria-label="Filtrar por responsável">
            <label className={styles.option}>
              <input
                type="radio"
                name="board-filter-assignee"
                checked={!state.unassigned && !state.assigneeId}
                onChange={() => update({ assigneeId: null, unassigned: false })}
              />
              Todos
            </label>
            <label className={styles.option}>
              <input
                type="radio"
                name="board-filter-assignee"
                checked={state.unassigned}
                onChange={() => update({ unassigned: true, assigneeId: null })}
              />
              Não atribuído
            </label>
            {users.map((candidate) => (
              <label key={candidate.id} className={styles.option}>
                <input
                  type="radio"
                  name="board-filter-assignee"
                  checked={!state.unassigned && state.assigneeId === candidate.id}
                  onChange={() => update({ assigneeId: candidate.id, unassigned: false })}
                />
                {candidate.name}
              </label>
            ))}
          </div>
        </details>

        <details className={styles.dropdown}>
          <summary className={styles.summary}>
            Bloqueio{state.blocked === true ? ' (Bloqueados)' : state.blocked === false ? ' (Não bloqueados)' : ''}
          </summary>
          <div className={styles.menu} role="group" aria-label="Filtrar por bloqueio">
            <label className={styles.option}>
              <input
                type="radio"
                name="board-filter-blocked"
                checked={state.blocked === null}
                onChange={() => update({ blocked: null })}
              />
              Todos
            </label>
            <label className={styles.option}>
              <input
                type="radio"
                name="board-filter-blocked"
                checked={state.blocked === true}
                onChange={() => update({ blocked: true })}
              />
              Bloqueados
            </label>
            <label className={styles.option}>
              <input
                type="radio"
                name="board-filter-blocked"
                checked={state.blocked === false}
                onChange={() => update({ blocked: false })}
              />
              Não bloqueados
            </label>
          </div>
        </details>

        {hasActiveFilters ? (
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => {
              setSearchInput('')
              clearAll()
            }}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      {hasActiveFilters ? (
        <ul className={styles.chips} aria-label="Filtros ativos">
          {state.search ? (
            <li className={styles.chip}>
              Busca: “{state.search}”
              <button type="button" onClick={clearSearch} aria-label="Remover filtro de busca">
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ) : null}
          {state.types.map((type) => (
            <li key={type} className={styles.chip}>
              {TYPE_LABELS[type]}
              <button
                type="button"
                onClick={() => update({ types: state.types.filter((item) => item !== type) })}
                aria-label={`Remover filtro de tipo ${TYPE_LABELS[type]}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
          {state.priorities.map((priority) => (
            <li key={priority} className={styles.chip}>
              {PRIORITY_LABELS[priority]}
              <button
                type="button"
                onClick={() => update({ priorities: state.priorities.filter((item) => item !== priority) })}
                aria-label={`Remover filtro de prioridade ${PRIORITY_LABELS[priority]}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
          {state.labelIds.map((labelId) => (
            <li key={labelId} className={styles.chip}>
              {labels?.find((label) => label.id === labelId)?.name ?? 'Label'}
              <button
                type="button"
                onClick={() => update({ labelIds: state.labelIds.filter((id) => id !== labelId) })}
                aria-label="Remover filtro de label"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
          {state.unassigned ? (
            <li className={styles.chip}>
              Não atribuído
              <button type="button" onClick={() => update({ unassigned: false })} aria-label="Remover filtro de responsável">
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ) : null}
          {!state.unassigned && selectedAssignee ? (
            <li className={styles.chip}>
              {selectedAssignee.name}
              <button type="button" onClick={() => update({ assigneeId: null })} aria-label="Remover filtro de responsável">
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ) : null}
          {state.blocked !== null ? (
            <li className={styles.chip}>
              {state.blocked ? 'Bloqueados' : 'Não bloqueados'}
              <button type="button" onClick={() => update({ blocked: null })} aria-label="Remover filtro de bloqueio">
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
