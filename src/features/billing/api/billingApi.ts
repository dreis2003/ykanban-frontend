import { httpClient } from '@/shared/api/httpClient'
import type {
  CheckoutSession,
  CheckoutSessionStatus,
  CustomerPortalSession,
  PlanCatalogEntry,
  StripePlanChangePreview,
} from '@/features/billing/types'

/** Self-service de billing tenant-scoped (ver ADR 0028) — checkout, status, Customer Portal e
 * troca de plano PROVIDER_MANAGED. Mutações exigem ADMIN (o backend reforça; aqui é só o cliente
 * HTTP). */
export const billingApi = {
  catalog: () => httpClient.get<PlanCatalogEntry[]>('/billing/plans'),
  createCheckoutSession: (planPriceId: string) =>
    httpClient.post<CheckoutSession>('/billing/checkout-sessions', { planPriceId }),
  checkoutSessionStatus: (checkoutId: string) =>
    httpClient.get<CheckoutSessionStatus>(`/billing/checkout-sessions/${checkoutId}`),
  createCustomerPortalSession: () => httpClient.post<CustomerPortalSession>('/billing/customer-portal-session'),
  previewChangePlan: (newPlanPriceId: string) =>
    httpClient.post<StripePlanChangePreview>('/billing/subscription/change-plan-preview', { newPlanPriceId }),
  requestPlanChange: (newPlanPriceId: string) => httpClient.post<void>('/billing/subscription/change-plan', { newPlanPriceId }),
  cancel: (mode: 'IMMEDIATE' | 'AT_PERIOD_END') => httpClient.post('/billing/subscription/cancel', { mode }),
}
