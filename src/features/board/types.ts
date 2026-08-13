export type KanbanColumnType =
  | 'BACKLOG'
  | 'READY'
  | 'DOING'
  | 'CODE_REVIEW'
  | 'TESTING'
  | 'READY_FOR_PRODUCTION'
  | 'PRODUCTION'

export interface KanbanColumn {
  id: string
  type: KanbanColumnType
  name: string
  position: number
  wipLimit: number | null
}

export interface Board {
  id: string
  projectId: string
  name: string
  columns: KanbanColumn[]
}

export interface UpdateKanbanColumnRequest {
  name: string
  wipLimit: number | null
}
