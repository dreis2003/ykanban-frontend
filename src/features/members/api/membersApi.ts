import { httpClient } from '@/shared/api/httpClient'
import type { ListMembersParams, Member, MembershipRole } from '@/features/members/types'
import type { PageResponse } from '@/shared/types/pageResponse'

const DEFAULT_PAGE_SIZE = 20

function buildListQuery(params: ListMembersParams): string {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? DEFAULT_PAGE_SIZE))
  query.set('sort', params.sort ?? 'name,asc')
  if (params.role) {
    query.set('role', params.role)
  }
  if (params.status) {
    query.set('status', params.status)
  }
  if (params.search) {
    query.set('search', params.search)
  }
  return query.toString()
}

export const membersApi = {
  list: (params: ListMembersParams) =>
    httpClient.get<PageResponse<Member>>(`/members?${buildListQuery(params)}`),
  changeRole: (membershipId: string, role: MembershipRole) =>
    httpClient.put<Member>(`/members/${membershipId}/role`, { role }),
  activate: (membershipId: string) => httpClient.post<Member>(`/members/${membershipId}/activate`),
  deactivate: (membershipId: string) => httpClient.post<Member>(`/members/${membershipId}/deactivate`),
  remove: (membershipId: string) => httpClient.delete<void>(`/members/${membershipId}`),
}
