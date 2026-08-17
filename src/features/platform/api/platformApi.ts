import { httpClient } from '@/shared/api/httpClient'
import type {
  ListPlatformTenantsParams,
  PlatformDashboard,
  PlatformTenant,
  PlatformTenantDetail,
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
  createTenant: (name: string, slug: string) =>
    httpClient.post<PlatformTenant>('/platform/tenants', { name, slug }),
  renameTenant: (tenantId: string, name: string) =>
    httpClient.patch<PlatformTenantDetail>(`/platform/tenants/${tenantId}`, { name }),
  suspendTenant: (tenantId: string) =>
    httpClient.post<PlatformTenantDetail>(`/platform/tenants/${tenantId}/suspend`),
  activateTenant: (tenantId: string) =>
    httpClient.post<PlatformTenantDetail>(`/platform/tenants/${tenantId}/activate`),
}
