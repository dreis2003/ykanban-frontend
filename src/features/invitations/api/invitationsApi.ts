import { httpClient } from '@/shared/api/httpClient'
import type {
  Invitation,
  InvitationCreated,
  InviteMemberRequest,
  ListInvitationsParams,
  PublicInvitation,
  RegisterViaInvitationRequest,
} from '@/features/invitations/types'
import type { LoginResponse, TenantSelectionResponse } from '@/features/auth/types'
import type { PageResponse } from '@/shared/types/pageResponse'

const DEFAULT_PAGE_SIZE = 20

function buildListQuery(params: ListInvitationsParams): string {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? DEFAULT_PAGE_SIZE))
  query.set('sort', params.sort ?? 'createdAt,desc')
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

export const invitationsApi = {
  list: (params: ListInvitationsParams) =>
    httpClient.get<PageResponse<Invitation>>(`/members/invitations?${buildListQuery(params)}`),
  invite: (payload: InviteMemberRequest) =>
    httpClient.post<InvitationCreated>('/members/invitations', payload),
  resend: (invitationId: string) =>
    httpClient.post<InvitationCreated>(`/members/invitations/${invitationId}/resend`),
  revoke: (invitationId: string) =>
    httpClient.post<Invitation>(`/members/invitations/${invitationId}/revoke`),

  // Público — sem autenticação (ver ADR 0022, itens 52-56).
  getPublicByToken: (token: string) =>
    httpClient.get<PublicInvitation>(`/public/invitations/${token}`, { skipAuthRetry: true }),
  registerViaInvitation: (token: string, payload: RegisterViaInvitationRequest) =>
    httpClient.post<LoginResponse>(`/public/invitations/${token}/register`, payload, { skipAuthRetry: true }),

  // Autenticado — QUALQUER contexto de token (ver SecurityConfig backend).
  accept: (token: string) => httpClient.post<TenantSelectionResponse>(`/invitations/${token}/accept`),
}
