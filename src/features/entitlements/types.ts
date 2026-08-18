/** Espelho de {@code AccessMode}/{@code AccessReason} (ver ADR 0026) — nunca derivado no frontend,
 * sempre o que o backend calculou via {@code TenantAccessPolicy}. */
export type AccessMode = 'READ_WRITE' | 'READ_ONLY'

export type AccessReason =
  | 'NORMAL'
  | 'TENANT_SUSPENDED'
  | 'SUBSCRIPTION_INACTIVE'
  | 'TRIAL_EXPIRED'
  | 'PAST_DUE_GRACE'
  | 'PAST_DUE_GRACE_EXPIRED'
  | 'SUBSCRIPTION_INCOMPLETE'
  | 'SUBSCRIPTION_UNPAID'
  | 'SUBSCRIPTION_PAUSED'

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'INCOMPLETE' | 'UNPAID' | 'PAUSED' | 'CANCELED' | 'EXPIRED'

export type LimitKey = 'MAX_MEMBERS' | 'MAX_PROJECTS'

export type LimitMode = 'LIMITED' | 'UNLIMITED' | 'NOT_CONFIGURED'

export type LimitState = 'UNLIMITED' | 'AVAILABLE' | 'AT_LIMIT' | 'OVER_LIMIT'

export interface LimitUsage {
  mode: LimitMode
  value: number | null
  usage: number
  state: LimitState
}

/** Resposta de {@code GET /entitlements} — {@code plan}/{@code subscriptionStatus} nulos quando o
 * Tenant não possui Subscription efetiva (ver ADR 0026, item 52). */
export interface Entitlements {
  plan: { id: string; name: string; code: string } | null
  subscriptionStatus: SubscriptionStatus | null
  accessMode: AccessMode
  accessReason: AccessReason
  limits: Partial<Record<LimitKey, LimitUsage>>
  features: Record<string, boolean>
}
