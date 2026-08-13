import { httpClient } from '@/shared/api/httpClient'
import type { AccessTokenResponse, AuthUser, LoginResponse } from '@/features/auth/types'

export const authApi = {
  login: (email: string, password: string) =>
    httpClient.post<LoginResponse>('/auth/login', { email, password }, { skipAuthRetry: true }),
  refresh: () =>
    httpClient.post<AccessTokenResponse>('/auth/refresh', undefined, { skipAuthRetry: true }),
  logout: () => httpClient.post<void>('/auth/logout', undefined, { skipAuthRetry: true }),
  me: () => httpClient.get<AuthUser>('/auth/me'),
}
