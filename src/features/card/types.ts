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

export interface ListCardsParams {
  type?: CardType
  priority?: CardPriority
  columnId?: string
  page?: number
  size?: number
}
