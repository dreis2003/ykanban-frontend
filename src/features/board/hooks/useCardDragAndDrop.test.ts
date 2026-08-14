import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { columnDroppableId, useCardDragAndDrop, type MoveResult } from './useCardDragAndDrop'
import type { Board } from '@/features/board/types'
import type { Card } from '@/features/card/types'

const BOARD: Board = {
  id: 'board-1',
  projectId: 'project-1',
  name: 'Kanban',
  columns: [
    { id: 'col-backlog', type: 'BACKLOG', name: 'Backlog', position: 1, wipLimit: null },
    { id: 'col-doing', type: 'DOING', name: 'Em Desenvolvimento', position: 2, wipLimit: null },
  ],
}

function cardIn(columnId: string, id: string, position: number): Card {
  const column = BOARD.columns.find((c) => c.id === columnId)!
  return {
    id,
    key: `YK-${id}`,
    number: Number(id.replace(/\D/g, '')) || 1,
    title: `Card ${id}`,
    description: null,
    type: 'FEATURE',
    priority: 'MEDIUM',
    projectId: 'project-1',
    column: { id: column.id, type: column.type, name: column.name },
    position,
    acceptanceCriteria: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function dragStart(id: string) {
  return { active: { id } } as never
}

function dragOver(activeId: string, overId: string) {
  return { active: { id: activeId }, over: { id: overId } } as never
}

function dragEnd(activeId: string, overId: string | null) {
  return { active: { id: activeId }, over: overId ? { id: overId } : null } as never
}

function firstCallResult(onMove: ReturnType<typeof vi.fn<(result: MoveResult) => void>>): MoveResult {
  const call = onMove.mock.calls[0]
  if (!call) {
    throw new Error('onMove não foi chamado')
  }
  return call[0]
}

describe('useCardDragAndDrop', () => {
  it('reorders within the same column and reports the final position on drop', () => {
    const cardsByColumnId = new Map<string, Card[]>([
      ['col-backlog', [cardIn('col-backlog', 'c1', 1), cardIn('col-backlog', 'c2', 2), cardIn('col-backlog', 'c3', 3)]],
    ])
    const onMove = vi.fn<(result: MoveResult) => void>()
    const { result } = renderHook(() =>
      useCardDragAndDrop({ board: BOARD, cardsByColumnId, disabled: false, onMove }),
    )

    act(() => result.current.handleDragStart(dragStart('c1')))
    act(() => result.current.handleDragOver(dragOver('c1', 'c3')))
    expect(result.current.displayCardsByColumnId.get('col-backlog')?.map((c) => c.id)).toEqual(['c2', 'c3', 'c1'])

    act(() => result.current.handleDragEnd(dragEnd('c1', 'c3')))

    expect(onMove).toHaveBeenCalledTimes(1)
    const call = firstCallResult(onMove)
    expect(call.cardId).toBe('c1')
    expect(call.targetColumnId).toBe('col-backlog')
    expect(call.targetPosition).toBe(3)
    expect(call.optimisticCards.find((c) => c.id === 'c1')?.position).toBe(3)
    expect(call.optimisticCards.find((c) => c.id === 'c2')?.position).toBe(1)
    // Preview é limpo após o drop — a UI volta a refletir o cache do React Query.
    expect(result.current.displayCardsByColumnId).toBe(cardsByColumnId)
  })

  it('moves a card across columns, resequencing both the origin and destination', () => {
    const cardsByColumnId = new Map<string, Card[]>([
      ['col-backlog', [cardIn('col-backlog', 'c1', 1), cardIn('col-backlog', 'c2', 2)]],
      ['col-doing', [cardIn('col-doing', 'c3', 1)]],
    ])
    const onMove = vi.fn<(result: MoveResult) => void>()
    const { result } = renderHook(() =>
      useCardDragAndDrop({ board: BOARD, cardsByColumnId, disabled: false, onMove }),
    )

    act(() => result.current.handleDragStart(dragStart('c1')))
    act(() => result.current.handleDragOver(dragOver('c1', columnDroppableId('col-doing'))))
    expect(result.current.overColumnId).toBe('col-doing')
    expect(result.current.displayCardsByColumnId.get('col-backlog')?.map((c) => c.id)).toEqual(['c2'])
    expect(result.current.displayCardsByColumnId.get('col-doing')?.map((c) => c.id)).toEqual(['c3', 'c1'])

    act(() => result.current.handleDragEnd(dragEnd('c1', columnDroppableId('col-doing'))))

    expect(onMove).toHaveBeenCalledTimes(1)
    const call = firstCallResult(onMove)
    expect(call.targetColumnId).toBe('col-doing')
    expect(call.targetPosition).toBe(2)
    const movedCard = call.optimisticCards.find((c) => c.id === 'c1')
    expect(movedCard?.column.id).toBe('col-doing')
    expect(movedCard?.position).toBe(2)
    expect(call.optimisticCards.find((c) => c.id === 'c2')?.position).toBe(1)
    expect(call.optimisticCards.find((c) => c.id === 'c3')?.position).toBe(1)
  })

  it('drops into an empty column at position 1', () => {
    const cardsByColumnId = new Map<string, Card[]>([
      ['col-backlog', [cardIn('col-backlog', 'c1', 1)]],
      ['col-doing', []],
    ])
    const onMove = vi.fn<(result: MoveResult) => void>()
    const { result } = renderHook(() =>
      useCardDragAndDrop({ board: BOARD, cardsByColumnId, disabled: false, onMove }),
    )

    act(() => result.current.handleDragStart(dragStart('c1')))
    act(() => result.current.handleDragOver(dragOver('c1', columnDroppableId('col-doing'))))
    act(() => result.current.handleDragEnd(dragEnd('c1', columnDroppableId('col-doing'))))

    expect(onMove).toHaveBeenCalledTimes(1)
    const call = firstCallResult(onMove)
    expect(call.targetPosition).toBe(1)
    expect(call.targetColumnId).toBe('col-doing')
  })

  it('does not call onMove when the drag is cancelled', () => {
    const cardsByColumnId = new Map<string, Card[]>([['col-backlog', [cardIn('col-backlog', 'c1', 1)]]])
    const onMove = vi.fn<(result: MoveResult) => void>()
    const { result } = renderHook(() =>
      useCardDragAndDrop({ board: BOARD, cardsByColumnId, disabled: false, onMove }),
    )

    act(() => result.current.handleDragStart(dragStart('c1')))
    act(() => result.current.handleDragOver(dragOver('c1', 'col-backlog')))
    act(() => result.current.handleDragCancel({} as never))

    expect(onMove).not.toHaveBeenCalled()
    expect(result.current.displayCardsByColumnId).toBe(cardsByColumnId)
    expect(result.current.activeCard).toBeNull()
  })

  it('does nothing when disabled', () => {
    const cardsByColumnId = new Map<string, Card[]>([['col-backlog', [cardIn('col-backlog', 'c1', 1)]]])
    const onMove = vi.fn<(result: MoveResult) => void>()
    const { result } = renderHook(() =>
      useCardDragAndDrop({ board: BOARD, cardsByColumnId, disabled: true, onMove }),
    )

    act(() => result.current.handleDragStart(dragStart('c1')))
    act(() => result.current.handleDragOver(dragOver('c1', 'col-doing')))
    act(() => result.current.handleDragEnd(dragEnd('c1', 'col-doing')))

    expect(onMove).not.toHaveBeenCalled()
    expect(result.current.activeCard).toBeNull()
  })
})
