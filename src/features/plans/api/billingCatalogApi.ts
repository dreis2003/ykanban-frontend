import { httpClient } from '@/shared/api/httpClient'

export interface BillingSyncStatus {
  synced: boolean
  provider: string
  externalProductId?: string | null
  externalPriceId?: string | null
}

/** Publicação de catálogo no billing provider (ver ADR 0028, PARTE F/Z) — exclusivo de Platform
 * Admin, sempre Stripe nesta fase. Idempotente no backend: publicar de novo reaproveita a mesma
 * referência. */
export const billingCatalogApi = {
  productStatus: (planId: string) => httpClient.get<BillingSyncStatus>(`/platform/plans/${planId}/billing/stripe`),
  publishPlan: (planId: string) => httpClient.post<BillingSyncStatus>(`/platform/plans/${planId}/billing/stripe/publish`),
  priceStatus: (planId: string, planPriceId: string) =>
    httpClient.get<BillingSyncStatus>(`/platform/plans/${planId}/prices/${planPriceId}/billing/stripe`),
  publishPrice: (planId: string, planPriceId: string) =>
    httpClient.post<BillingSyncStatus>(`/platform/plans/${planId}/prices/${planPriceId}/billing/stripe/publish`),
}
