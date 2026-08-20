import type { PlanPrice } from '@/features/plans/types'

/** Catálogo público (ver ADR 0029/Prompt 30, PARTE B) — mesma forma de `PlanCatalogEntry`
 * (features/billing), mas servido sem autenticação por `GET /public/plans`. */
export interface PublicPlan {
  id: string
  code: string
  name: string
  description: string
  prices: PlanPrice[]
}

export interface CreateSubscriptionSignupRequest {
  organizationName: string
  email: string
  slug: string
  planPriceId: string
  termsAccepted: boolean
}

export interface SubscriptionSignupCreated {
  signupId: string
  checkoutUrl: string
}

export type SubscriptionSignupStatus = 'NOT_PAID' | 'PROCESSING' | 'ACCOUNT_SETUP_EMAIL_SENT' | 'COMPLETED' | 'FAILED'

export interface SubscriptionSignupStatusResponse {
  status: SubscriptionSignupStatus
  organizationName: string
  maskedContactEmail: string
}

export interface AccountSetupValidation {
  valid: boolean
  organizationName: string | null
  maskedEmail: string | null
  expiresAt: string | null
}

export interface AccountSetupRegisterRequest {
  token: string
  name: string
  password: string
}
