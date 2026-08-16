import { httpClient } from '@/shared/api/httpClient'
import type { PageResponse } from '@/shared/types/pageResponse'
import type { ListUsersParams, UserSummary } from '@/features/user/types'

const DEFAULT_PAGE_SIZE = 20

function buildListQuery(params: ListUsersParams): string {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? DEFAULT_PAGE_SIZE))
  if (params.status) {
    query.set('status', params.status)
  }
  if (params.search) {
    query.set('search', params.search)
  }
  return query.toString()
}

export const userApi = {
  list: (params: ListUsersParams = {}) =>
    httpClient.get<PageResponse<UserSummary>>(`/users?${buildListQuery(params)}`),
}
