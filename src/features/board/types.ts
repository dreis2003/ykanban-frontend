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
  /** Contagem real (nunca filtrada — ver ADR 0016/0017), usada para o cálculo de WIP mesmo com um
   * filtro do Board ativo, quando a lista de Cards exibida pode estar reduzida. */
  cardCount: number
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
