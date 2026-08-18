import { httpClient } from '@/shared/api/httpClient'
import type {
  ListPlatformTenantsParams,
  PlatformDashboard,
  PlatformTenant,
  PlatformTenantDetail,
  ProvisioningResponse,
} from '@/features/platform/types'
import type { PageResponse } from '@/shared/types/pageResponse'

const DEFAULT_PAGE_SIZE = 20

function buildListQuery(params: ListPlatformTenantsParams): string {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? DEFAULT_PAGE_SIZE))
  query.set('sort', params.sort ?? 'name,asc')
  if (params.status) {
    query.set('status', params.status)
  }
  if (params.search) {
    query.set('search', params.search)
  }
  return query.toString()
}

export const platformApi = {
  dashboard: () => httpClient.get<PlatformDashboard>('/platform/dashboard'),
  listTenants: (params: ListPlatformTenantsParams) =>
    httpClient.get<PageResponse<PlatformTenant>>(`/platform/tenants?${buildListQuery(params)}`),
  getTenant: (tenantId: string) =>
    httpClient.get<PlatformTenantDetail>(`/platform/tenants/${tenantId}`),
  /** {@code idempotencyKey} opcional (ver ADR 0024) — protege contra double-click/retry
   * duplicando a empresa; gerado pelo chamador (ex.: `crypto.randomUUID()`) uma vez por tentativa
   * de submit, reaproveitado entre retries da MESMA tentativa. {@code planId} é obrigatório desde
   * o ADR 0026 — nenhuma empresa nasce sem Subscription. */
  createTenant: (name: string, slug: string, adminEmail: string, planId: string, idempotencyKey?: string) =>
    httpClient.post<ProvisioningResponse>(
      '/platform/tenants',
      { name, slug, adminEmail, planId },
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
    ),
  renameTenant: (tenantId: string, name: string) =>
    httpClient.patch<PlatformTenantDetail>(`/platform/tenants/${tenantId}`, { name }),
  suspendTenant: (tenantId: string) =>
    httpClient.post<PlatformTenantDetail>(`/platform/tenants/${tenantId}/suspend`),
  activateTenant: (tenantId: string) =>
    httpClient.post<PlatformTenantDetail>(`/platform/tenants/${tenantId}/activate`),
  resendInitialAdminInvitation: (tenantId: string) =>
    httpClient.post<PlatformTenantDetail>(`/platform/tenants/${tenantId}/initial-admin-invitation/resend`),
  replaceInitialAdminInvitation: (tenantId: string, email: string) =>
    httpClient.post<PlatformTenantDetail>(`/platform/tenants/${tenantId}/initial-admin-invitation/replace`, { email }),
  revokeInitialAdminInvitation: (tenantId: string) =>
    httpClient.post<PlatformTenantDetail>(`/platform/tenants/${tenantId}/initial-admin-invitation/revoke`),
}
