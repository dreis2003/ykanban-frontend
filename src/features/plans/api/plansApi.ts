import { httpClient } from '@/shared/api/httpClient'
import type {
  AssignablePlan,
  CreatePlanPriceValues,
  CreatePlanValues,
  FeatureKey,
  LimitKey,
  LimitMode,
  ListPlansParams,
  Plan,
  PlanDetail,
  PlanPrice,
  UpdatePlanValues,
} from '@/features/plans/types'
import type { PageResponse } from '@/shared/types/pageResponse'

const DEFAULT_PAGE_SIZE = 20
const DEFAULT_SORT = 'name,asc'

function buildListQuery(params: ListPlansParams): string {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? DEFAULT_PAGE_SIZE))
  query.set('sort', params.sort ?? DEFAULT_SORT)
  if (params.status) {
    query.set('status', params.status)
  }
  if (params.search) {
    query.set('search', params.search)
  }
  return query.toString()
}

export const plansApi = {
  list: (params: ListPlansParams) => httpClient.get<PageResponse<Plan>>(`/platform/plans?${buildListQuery(params)}`),
  assignable: () => httpClient.get<AssignablePlan[]>('/platform/plans/assignable'),
  getById: (planId: string) => httpClient.get<PlanDetail>(`/platform/plans/${planId}`),
  create: (values: CreatePlanValues) => httpClient.post<Plan>('/platform/plans', values),
  update: (planId: string, values: UpdatePlanValues) => httpClient.patch<Plan>(`/platform/plans/${planId}`, values),
  setFeature: (planId: string, featureKey: FeatureKey, enabled: boolean) =>
    httpClient.put<PlanDetail>(`/platform/plans/${planId}/features/${featureKey}`, { enabled }),
  setLimit: (planId: string, limitKey: LimitKey, mode: LimitMode, value: number | null) =>
    httpClient.put<PlanDetail>(`/platform/plans/${planId}/limits/${limitKey}`, { mode, value }),
  activate: (planId: string) => httpClient.post<Plan>(`/platform/plans/${planId}/activate`),
  deactivate: (planId: string) => httpClient.post<Plan>(`/platform/plans/${planId}/deactivate`),
  featureCatalog: () => httpClient.get<FeatureKey[]>('/platform/entitlements/features'),
  limitCatalog: () => httpClient.get<LimitKey[]>('/platform/entitlements/limits'),
  listPrices: (planId: string) => httpClient.get<PlanPrice[]>(`/platform/plans/${planId}/prices`),
  createPrice: (planId: string, values: CreatePlanPriceValues) =>
    httpClient.post<PlanPrice>(`/platform/plans/${planId}/prices`, values),
  deactivatePrice: (planId: string, planPriceId: string) =>
    httpClient.post<PlanPrice>(`/platform/plans/${planId}/prices/${planPriceId}/deactivate`),
}
