export type PlanStatus = 'ACTIVE' | 'INACTIVE'

/** Conjunto fechado de capacidades de código — nunca inventado pelo Platform Admin, sempre um
 * espelho do enum {@code FeatureKey} do backend (ver ADR 0025). */
export type FeatureKey = 'GITHUB_INTEGRATION' | 'AI_AGENTS' | 'ADVANCED_ANALYTICS'

/** Conjunto fechado de limites numéricos configuráveis por plano — espelho de {@code LimitKey}. */
export type LimitKey = 'MAX_MEMBERS' | 'MAX_PROJECTS'

export type LimitMode = 'LIMITED' | 'UNLIMITED'

export interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  status: PlanStatus
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export interface PlanFeatureSlot {
  key: FeatureKey
  enabled: boolean
}

/** {@code mode}/{@code value} são {@code null} quando {@code configured} é {@code false} — a
 * ausência de configuração NUNCA deve ser lida como "ilimitado" (ver ADR 0025, item 42). */
export interface PlanLimitSlot {
  key: LimitKey
  configured: boolean
  mode: LimitMode | null
  value: number | null
}

/** Lista SEMPRE todas as {@code FeatureKey}/{@code LimitKey} conhecidas pelo sistema — permite
 * mostrar ao Platform Admin o que falta configurar antes de ativar, sem round-trips extras. */
export interface PlanDetail extends Plan {
  features: PlanFeatureSlot[]
  limits: PlanLimitSlot[]
}

/** Espelho de {@code BillingInterval}/{@code PlanPriceStatus} (ver ADR 0027) — {@code amountMinor}
 * é sempre a menor unidade da moeda (nunca decimal), formatar com {@code formatMoney} antes de
 * exibir. Preço nunca é excluído fisicamente — só {@code deactivate}. */
export type BillingInterval = 'MONTHLY' | 'YEARLY'

export type PlanPriceStatus = 'ACTIVE' | 'INACTIVE'

export interface PlanPrice {
  id: string
  planId: string
  billingInterval: BillingInterval
  currency: string
  amountMinor: number
  status: PlanPriceStatus
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreatePlanPriceValues {
  billingInterval: BillingInterval
  currency: string
  amountMinor: number
  displayOrder: number
}

export type PlanSortOption = 'displayOrder,name,asc' | 'name,asc' | 'name,desc' | 'code,asc' | 'createdAt,desc'

export interface ListPlansParams {
  status?: PlanStatus
  search?: string
  page?: number
  size?: number
  sort?: PlanSortOption
}

/** Plano selecionável para uma nova/alterada Subscription — sempre COMMERCIAL + ACTIVE (ver ADR
 * 0026). Nunca inclui Plans SYSTEM (ex.: Legacy Internal). */
export interface AssignablePlan {
  id: string
  code: string
  name: string
}

export interface CreatePlanValues {
  name: string
  code: string
  description: string
  displayOrder: number
}

export interface UpdatePlanValues {
  name: string
  description: string
  displayOrder: number
}
