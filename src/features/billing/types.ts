import type { PlanPrice } from '@/features/plans/types'

/** Catálogo comercial publicado (ver ADR 0028, item 182) — só Plans COMMERCIAL/ACTIVE com ao menos
 * um preço ACTIVE já publicado no provider aparecem aqui. */
export interface PlanCatalogEntry {
  id: string
  code: string
  name: string
  description: string
  prices: PlanPrice[]
}

export type CheckoutStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELED'

export interface CheckoutSession {
  checkoutId: string
  checkoutUrl: string
}

export interface CheckoutSessionStatus {
  checkoutId: string
  status: CheckoutStatus
  planPriceId: string
  completedAt: string | null
}

export interface CustomerPortalSession {
  url: string
}

export interface StripePlanChangePreview {
  operational: {
    currentPlan: { id: string; code: string; name: string }
    targetPlan: { id: string; code: string; name: string }
    limits: Record<string, { usage: number; targetMode: string; targetLimit: number | null; willBeOverLimit: boolean }>
    featuresGained: string[]
    featuresLost: string[]
  }
  amountDueMinor: number
  currency: string
  prorationDate: string
}
