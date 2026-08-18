import { httpClient } from '@/shared/api/httpClient'
import type { Entitlements } from '@/features/entitlements/types'

export const entitlementsApi = {
  current: () => httpClient.get<Entitlements>('/entitlements'),
}
