import { httpClient } from '@/shared/api/httpClient'
import type {
  AccessTokenResponse,
  AvailableTenant,
  LoginResponse,
  MeResponse,
  TenantSelectionResponse,
} from '@/features/auth/types'

export const authApi = {
  login: (email: string, password: string) =>
    httpClient.post<LoginResponse>('/auth/login', { email, password }, { skipAuthRetry: true }),
  refresh: () =>
    httpClient.post<AccessTokenResponse>('/auth/refresh', undefined, { skipAuthRetry: true }),
  logout: () => httpClient.post<void>('/auth/logout', undefined, { skipAuthRetry: true }),
  me: () => httpClient.get<MeResponse>('/auth/me'),
  availableTenants: () => httpClient.get<AvailableTenant[]>('/auth/tenants'),
  selectTenant: (tenantId: string) =>
    httpClient.post<TenantSelectionResponse>('/auth/tenant', { tenantId }),
}
