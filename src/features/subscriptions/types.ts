import type { LimitKey, LimitMode, LimitUsage } from '@/features/entitlements/types'

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'INCOMPLETE' | 'UNPAID' | 'PAUSED' | 'CANCELED' | 'EXPIRED'

export type SubscriptionSource = 'LEGACY_MIGRATION' | 'PLATFORM_MANUAL' | 'BILLING_PROVIDER'

/** Ver ADR 0027, PARTE F — {@code MANUAL} nunca tem {@code billingProvider}/{@code
 * externalSubscriptionId}/período/{@code planPriceId}; {@code PROVIDER_MANAGED} sempre tem. */
export type SubscriptionManagementMode = 'MANUAL' | 'PROVIDER_MANAGED'

export type BillingProvider = 'MOCK' | 'STRIPE'

export interface PlanSummary {
  id: string
  code: string
  name: string
}

export interface Subscription {
  id: string
  tenantId: string
  plan: PlanSummary
  status: SubscriptionStatus
  source: SubscriptionSource
  managementMode: SubscriptionManagementMode
  billingProvider: BillingProvider | null
  externalSubscriptionId: string | null
  planPriceId: string | null
  startedAt: string
  trialEndsAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  pastDueSince: string | null
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  endedAt: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
  /** {@code null} no histórico — só a Subscription efetiva atual expõe uso corrente (ver ADR 0026,
   * itens 110/113). */
  limits: Partial<Record<LimitKey, LimitUsage>> | null
}

export interface CreateSubscriptionValues {
  planId: string
  status: 'ACTIVE' | 'TRIALING'
  trialEndsAt?: string
}

export interface LimitChangePreview {
  usage: number
  targetMode: LimitMode
  targetLimit: number | null
  willBeOverLimit: boolean
}

export interface PlanChangePreview {
  currentPlan: PlanSummary
  targetPlan: PlanSummary
  limits: Partial<Record<LimitKey, LimitChangePreview>>
  featuresGained: string[]
  featuresLost: string[]
}
