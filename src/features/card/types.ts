export type CardType = 'FEATURE' | 'BUG' | 'REFACTOR' | 'TECH' | 'SPIKE'

export type CardPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface CardColumnSummary {
  id: string
  type: string
  name: string
}

export interface AcceptanceCriterion {
  id: string
  description: string
  completed: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export interface CardLabelSummary {
  id: string
  name: string
  color: string
}

export interface CardAssigneeSummary {
  id: string
  name: string
  email: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface CardBlockedBySummary {
  id: string
  name: string
}

export interface CardBlockInfo {
  reason: string
  blockedAt: string
  blockedBy: CardBlockedBySummary
}

export interface CommentAuthor {
  id: string
  name: string
}

/** Não faz parte de `Card` — comentários têm endpoint/paginação própria (ver commentApi),
 * nunca embutidos em `CardResponse` (evitaria inflar a listagem paginada do board). `content` é
 * `null` quando `deleted=true`. */
export interface Comment {
  id: string
  content: string | null
  author: CommentAuthor
  createdAt: string
  updatedAt: string
  deleted: boolean
}

/** Eventos ainda não conhecidos pelo frontend caem aqui (ver historyFormatter) — nunca falha ao
 * renderizar por causa de um eventType novo que o backend passe a emitir no futuro. */
export type CardHistoryEventType =
  | 'CARD_CREATED'
  | 'CARD_UPDATED'
  | 'CARD_MOVED'
  | 'CARD_BLOCKED'
  | 'CARD_UNBLOCKED'
  | 'ASSIGNEE_CHANGED'
  | 'LABEL_ADDED'
  | 'LABEL_REMOVED'
  | 'ACCEPTANCE_CRITERION_ADDED'
  | 'ACCEPTANCE_CRITERION_UPDATED'
  | 'ACCEPTANCE_CRITERION_COMPLETED'
  | 'ACCEPTANCE_CRITERION_REOPENED'
  | 'ACCEPTANCE_CRITERION_REMOVED'
  | 'ACCEPTANCE_CRITERION_MOVED'
  | 'COMMENT_ADDED'
  | 'COMMENT_UPDATED'
  | 'COMMENT_REMOVED'

export interface CardHistoryActor {
  id: string
  name: string
}

/** `metadata` é heterogêneo por natureza (cada eventType guarda campos diferentes) — ver
 * agent_docs/decisions/0015-card-history.md. Nunca editado/removido pela API (append-only). */
export interface CardHistoryEvent {
  id: string
  eventType: CardHistoryEventType | (string & {})
  actor: CardHistoryActor | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface CreateCommentRequest {
  content: string
}

export interface UpdateCommentRequest {
  content: string
}

export interface Card {
  id: string
  key: string
  number: number
  title: string
  description: string | null
  type: CardType
  priority: CardPriority
  projectId: string
  column: CardColumnSummary
  position: number
  acceptanceCriteria: AcceptanceCriterion[]
  labels: CardLabelSummary[]
  assignee: CardAssigneeSummary | null
  blocked: boolean
  block: CardBlockInfo | null
  createdAt: string
  updatedAt: string
}

export interface CreateAcceptanceCriterionRequest {
  description: string
}

export interface UpdateAcceptanceCriterionRequest {
  description: string
}

export interface MoveAcceptanceCriterionRequest {
  targetPosition: number
}

export interface CreateCardRequest {
  title: string
  description?: string
  type: CardType
  priority: CardPriority
}

export interface UpdateCardRequest {
  title: string
  description?: string
  type: CardType
  priority: CardPriority
}

export interface MoveCardRequest {
  targetColumnId: string
  targetPosition: number
}

/** Sem paginação de propósito — ver ADR 0016 (backend também não pagina este endpoint).
 * `types`/`priorities`/`labelIds` combinam com OR entre si; categorias diferentes combinam com
 * AND. `assigneeId` e `unassigned` são mutuamente exclusivos (backend rejeita os dois juntos). */
export interface CardSearchCriteria {
  search?: string
  types?: CardType[]
  priorities?: CardPriority[]
  columnId?: string
  labelIds?: string[]
  assigneeId?: string
  unassigned?: boolean
  blocked?: boolean
}
