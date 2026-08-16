import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CardPriority, CardSearchCriteria, CardType } from '@/features/card/types'

const CARD_TYPES: readonly CardType[] = ['FEATURE', 'BUG', 'REFACTOR', 'TECH', 'SPIKE']
const CARD_PRIORITIES: readonly CardPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function parseCsvEnum<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (!value) {
    return []
  }
  return value.split(',').filter((item): item is T => (allowed as readonly string[]).includes(item))
}

function parseCsv(value: string | null): string[] {
  if (!value) {
    return []
  }
  return value.split(',').filter(Boolean)
}

function parseTriState(value: string | null): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export interface BoardFiltersState {
  search: string
  types: CardType[]
  priorities: CardPriority[]
  labelIds: string[]
  assigneeId: string | null
  unassigned: boolean
  blocked: boolean | null
}

const PARAM_KEYS = ['search', 'types', 'priorities', 'labelIds', 'assigneeId', 'unassigned', 'blocked'] as const

/**
 * Filtros do Board sincronizados na URL (ver ADR 0016) — permite compartilhar/recarregar a página
 * mantendo o filtro ativo. Valores desconhecidos/inválidos na URL (ex.: um `types` editado à mão)
 * são silenciosamente ignorados em vez de quebrar a página.
 */
export function useBoardFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const state: BoardFiltersState = useMemo(() => {
    const unassigned = searchParams.get('unassigned') === 'true'
    return {
      search: searchParams.get('search') ?? '',
      types: parseCsvEnum(searchParams.get('types'), CARD_TYPES),
      priorities: parseCsvEnum(searchParams.get('priorities'), CARD_PRIORITIES),
      labelIds: parseCsv(searchParams.get('labelIds')),
      assigneeId: unassigned ? null : searchParams.get('assigneeId'),
      unassigned,
      blocked: parseTriState(searchParams.get('blocked')),
    }
  }, [searchParams])

  const criteria: CardSearchCriteria = useMemo(
    () => ({
      ...(state.search ? { search: state.search } : {}),
      ...(state.types.length ? { types: state.types } : {}),
      ...(state.priorities.length ? { priorities: state.priorities } : {}),
      ...(state.labelIds.length ? { labelIds: state.labelIds } : {}),
      ...(state.unassigned ? { unassigned: true } : state.assigneeId ? { assigneeId: state.assigneeId } : {}),
      ...(state.blocked !== null ? { blocked: state.blocked } : {}),
    }),
    [state],
  )

  const hasActiveFilters =
    Boolean(state.search) ||
    state.types.length > 0 ||
    state.priorities.length > 0 ||
    state.labelIds.length > 0 ||
    state.unassigned ||
    Boolean(state.assigneeId) ||
    state.blocked !== null

  const update = useCallback(
    (patch: Partial<BoardFiltersState>) => {
      setSearchParams(
        (current) => {
          const merged: BoardFiltersState = {
            search: current.get('search') ?? '',
            types: parseCsvEnum(current.get('types'), CARD_TYPES),
            priorities: parseCsvEnum(current.get('priorities'), CARD_PRIORITIES),
            labelIds: parseCsv(current.get('labelIds')),
            assigneeId: current.get('unassigned') === 'true' ? null : current.get('assigneeId'),
            unassigned: current.get('unassigned') === 'true',
            blocked: parseTriState(current.get('blocked')),
            ...patch,
          }
          const next = new URLSearchParams(current)
          PARAM_KEYS.forEach((key) => next.delete(key))
          if (merged.search) next.set('search', merged.search)
          if (merged.types.length) next.set('types', merged.types.join(','))
          if (merged.priorities.length) next.set('priorities', merged.priorities.join(','))
          if (merged.labelIds.length) next.set('labelIds', merged.labelIds.join(','))
          if (merged.unassigned) {
            next.set('unassigned', 'true')
          } else if (merged.assigneeId) {
            next.set('assigneeId', merged.assigneeId)
          }
          if (merged.blocked !== null) next.set('blocked', String(merged.blocked))
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearAll = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        PARAM_KEYS.forEach((key) => next.delete(key))
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  return { state, criteria, hasActiveFilters, update, clearAll }
}
