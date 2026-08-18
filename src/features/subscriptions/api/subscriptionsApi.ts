import { httpClient } from '@/shared/api/httpClient'
import type { CreateSubscriptionValues, PlanChangePreview, Subscription } from '@/features/subscriptions/types'
import type { PageResponse } from '@/shared/types/pageResponse'

/** Administração de Subscriptions pela plataforma SaaS (ver ADR 0026) — exclusivo de Platform
 * Admin, sempre escopado a um {@code tenantId} explícito do path. */
export const subscriptionsApi = {
  getCurrent: (tenantId: string) => httpClient.get<Subscription>(`/platform/tenants/${tenantId}/subscription`),
  getHistory: (tenantId: string) =>
    httpClient.get<PageResponse<Subscription>>(`/platform/tenants/${tenantId}/subscriptions?sort=startedAt,desc`),
  create: (tenantId: string, values: CreateSubscriptionValues) =>
    httpClient.post<Subscription>(`/platform/tenants/${tenantId}/subscriptions`, values),
  previewChangePlan: (tenantId: string, planId: string) =>
    httpClient.post<PlanChangePreview>(`/platform/tenants/${tenantId}/subscription/change-plan-preview`, { planId }),
  changePlan: (tenantId: string, planId: string) =>
    httpClient.post<Subscription>(`/platform/tenants/${tenantId}/subscription/change-plan`, { planId }),
  cancel: (tenantId: string) => httpClient.post<Subscription>(`/platform/tenants/${tenantId}/subscription/cancel`),
}
